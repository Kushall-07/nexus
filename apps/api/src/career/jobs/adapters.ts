import type { EmploymentType, JobProviderId, JobSearchQuery, NormalizedJob } from "../types.js";
import {
  asRecord,
  asString,
  fetchJson,
  ProviderError,
  type JobProvider,
  type ProviderDeps,
} from "./provider.js";
import {
  extractSkills,
  htmlToText,
  inferEmploymentType,
  inferExperienceLevel,
  inferStudentOnly,
  inferWorkMode,
  isStale,
  safeHttpUrl,
  safeIsoDate,
} from "./text.js";

// Real provider adapters. Response shapes follow each provider's published
// documentation as of implementation, but none of these has been exercised
// against the live service (no credentials were available): unit tests use
// recorded-shape fixtures only. Malformed entries are skipped, never repaired.

interface RawListing {
  provider: JobProviderId;
  providerJobId: string | undefined;
  title: string | undefined;
  company?: string;
  descriptionHtml?: string;
  location?: string;
  tags?: string[];
  employmentHint?: string;
  postedAt?: unknown;
  url: unknown;
  sourceName: string;
  salary?: NormalizedJob["salary"];
  remoteHint?: boolean;
}

export function buildJob(raw: RawListing, now: Date): NormalizedJob | null {
  const url = safeHttpUrl(raw.url);
  const providerJobId = raw.providerJobId?.slice(0, 200);

  // A listing without a title, identifier or valid link cannot be shown honestly.
  if (!raw.title || !providerJobId || !url) return null;

  const description = htmlToText(raw.descriptionHtml ?? "");
  const skills = extractSkills(`${raw.title}\n${description}`, raw.tags ?? []);
  const postedAt = safeIsoDate(raw.postedAt);
  const workMode = raw.remoteHint ? ("remote" as const) : inferWorkMode(`${raw.location ?? ""} ${raw.title}`);

  return {
    id: `${raw.provider}:${providerJobId}`,
    provider: raw.provider,
    providerJobId,
    isDemo: false,
    title: htmlToText(raw.title, 200),
    company: raw.company ? htmlToText(raw.company, 200) : undefined,
    description,
    location: raw.location ? htmlToText(raw.location, 200) : undefined,
    workMode,
    // A title that says "intern" outranks a generic "full time" contract hint.
    employmentType:
      inferEmploymentType(raw.title) === "internship"
        ? "internship"
        : (inferEmploymentType(raw.employmentHint ?? "") ?? inferEmploymentType(raw.title)),
    experienceLevel: inferExperienceLevel(raw.title),
    salary: raw.salary,
    requiredSkills: skills.required,
    preferredSkills: skills.preferred,
    qualifications: [],
    studentOnly: inferStudentOnly(`${raw.title} ${description}`),
    postedAt,
    url,
    sourceName: raw.sourceName,
    retrievedAt: now.toISOString(),
    stale: isStale(postedAt, now),
  };
}

function compact(jobs: Array<NormalizedJob | null>): NormalizedJob[] {
  return jobs.filter((job): job is NormalizedJob => job !== null);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---- Remotive: remote jobs, no credentials; enabled by REMOTIVE_ENABLED. ----
// Remotive asks consumers to credit the source and avoid frequent polling:
// results are cached and every job links back to remotive.com.
export function createRemotiveProvider(deps: ProviderDeps & { enabled: boolean }): JobProvider {
  return {
    id: "remotive",
    label: "Remotive",
    status: () => ({
      id: "remotive",
      label: "Remotive (remote jobs)",
      configured: deps.enabled,
      hint: deps.enabled ? undefined : "Set REMOTIVE_ENABLED=true to include Remotive remote listings.",
    }),
    async search(query: JobSearchQuery, now: Date) {
      // Remotive only lists remote positions: other work modes cannot match.
      if (query.workMode && query.workMode !== "remote") return [];

      const params = new URLSearchParams({ limit: String(Math.min(query.limit, 50)) });
      if (query.keywords) params.set("search", query.keywords);

      const body = asRecord(await fetchJson(`https://remotive.com/api/remote-jobs?${params}`, {}, deps));
      if (!body || !Array.isArray(body.jobs)) throw new ProviderError("bad_response", "Unexpected Remotive response.");

      return compact(
        body.jobs.map((entry) => {
          const job = asRecord(entry);
          if (!job) return null;
          return buildJob(
            {
              provider: "remotive",
              providerJobId: job.id === undefined ? undefined : String(job.id),
              title: asString(job.title),
              company: asString(job.company_name),
              descriptionHtml: asString(job.description),
              location: asString(job.candidate_required_location),
              tags: list(job.tags).filter((tag): tag is string => typeof tag === "string"),
              employmentHint: asString(job.job_type)?.replace(/_/g, " "),
              postedAt: job.publication_date,
              url: job.url,
              sourceName: "Remotive",
              remoteHint: true,
            },
            now,
          );
        }),
      );
    },
  };
}

// ---- Adzuna: needs ADZUNA_APP_ID + ADZUNA_APP_KEY. ----
const ADZUNA_CONTRACT: Partial<Record<EmploymentType, string>> = { "full-time": "full_time", "part-time": "part_time", contract: "contract" };

export function createAdzunaProvider(deps: ProviderDeps & { appId?: string; appKey?: string; country: string }): JobProvider {
  const configured = Boolean(deps.appId && deps.appKey);

  return {
    id: "adzuna",
    label: "Adzuna",
    status: () => ({
      id: "adzuna",
      label: "Adzuna",
      configured,
      hint: configured ? undefined : "Set ADZUNA_APP_ID and ADZUNA_APP_KEY (free developer account at developer.adzuna.com).",
    }),
    async search(query: JobSearchQuery, now: Date) {
      if (!configured) throw new ProviderError("auth", "Adzuna is not configured.");

      const params = new URLSearchParams({
        app_id: deps.appId!,
        app_key: deps.appKey!,
        results_per_page: String(Math.min(query.limit, 50)),
        "content-type": "application/json",
      });
      const what = [query.keywords, query.employmentType === "internship" ? "intern" : undefined, query.workMode === "remote" ? "remote" : undefined]
        .filter(Boolean)
        .join(" ");
      if (what) params.set("what", what);
      if (query.location) params.set("where", query.location);
      const contract = query.employmentType ? ADZUNA_CONTRACT[query.employmentType] : undefined;
      if (contract) params.set(contract, "1");

      const url = `https://api.adzuna.com/v1/api/jobs/${deps.country}/search/${query.page}?${params}`;
      const body = asRecord(await fetchJson(url, {}, deps));
      if (!body || !Array.isArray(body.results)) throw new ProviderError("bad_response", "Unexpected Adzuna response.");

      return compact(
        body.results.map((entry) => {
          const job = asRecord(entry);
          if (!job) return null;
          const min = typeof job.salary_min === "number" ? job.salary_min : undefined;
          const max = typeof job.salary_max === "number" ? job.salary_max : undefined;
          // Adzuna may predict salaries (salary_is_predicted="1"); predicted values are not shown as stated pay.
          const predicted = String(job.salary_is_predicted ?? "0") === "1";

          return buildJob(
            {
              provider: "adzuna",
              providerJobId: job.id === undefined ? undefined : String(job.id),
              title: asString(job.title),
              company: asString(asRecord(job.company)?.display_name),
              descriptionHtml: asString(job.description),
              location: asString(asRecord(job.location)?.display_name),
              employmentHint: [asString(job.contract_time)?.replace(/_/g, " "), asString(job.contract_type)].filter(Boolean).join(" "),
              postedAt: job.created,
              url: job.redirect_url,
              sourceName: "Adzuna",
              salary: !predicted && (min !== undefined || max !== undefined) ? { min, max, period: "year" } : undefined,
            },
            now,
          );
        }),
      );
    },
  };
}

// ---- JSearch (RapidAPI): needs JSEARCH_API_KEY. ----
const JSEARCH_TYPES: Record<EmploymentType, string | undefined> = {
  internship: "INTERN",
  "full-time": "FULLTIME",
  "part-time": "PARTTIME",
  contract: "CONTRACTOR",
  other: undefined,
};

export function createJSearchProvider(deps: ProviderDeps & { apiKey?: string }): JobProvider {
  const configured = Boolean(deps.apiKey);

  return {
    id: "jsearch",
    label: "JSearch",
    status: () => ({
      id: "jsearch",
      label: "JSearch (RapidAPI)",
      configured,
      hint: configured ? undefined : "Set JSEARCH_API_KEY (subscribe to JSearch on RapidAPI; check the plan's quota and terms).",
    }),
    async search(query: JobSearchQuery, now: Date) {
      if (!configured) throw new ProviderError("auth", "JSearch is not configured.");

      const text = [query.keywords || "software developer", query.location ? `in ${query.location}` : ""].filter(Boolean).join(" ");
      const params = new URLSearchParams({ query: text, page: String(query.page), num_pages: "1" });
      if (query.workMode === "remote") params.set("work_from_home", "true");
      const type = query.employmentType ? JSEARCH_TYPES[query.employmentType] : undefined;
      if (type) params.set("employment_types", type);

      const body = asRecord(
        await fetchJson(
          `https://jsearch.p.rapidapi.com/search?${params}`,
          { headers: { "X-RapidAPI-Key": deps.apiKey!, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" } },
          deps,
        ),
      );
      if (!body || !Array.isArray(body.data)) throw new ProviderError("bad_response", "Unexpected JSearch response.");

      return compact(
        body.data.slice(0, query.limit).map((entry) => {
          const job = asRecord(entry);
          if (!job) return null;
          const min = typeof job.job_min_salary === "number" ? job.job_min_salary : undefined;
          const max = typeof job.job_max_salary === "number" ? job.job_max_salary : undefined;
          const period = String(job.job_salary_period ?? "").toUpperCase();
          const location = [asString(job.job_city), asString(job.job_state), asString(job.job_country)].filter(Boolean).join(", ");

          return buildJob(
            {
              provider: "jsearch",
              providerJobId: asString(job.job_id),
              title: asString(job.job_title),
              company: asString(job.employer_name),
              descriptionHtml: asString(job.job_description),
              location: location || undefined,
              employmentHint: asString(job.job_employment_type)?.replace(/_/g, " "),
              postedAt: job.job_posted_at_datetime_utc,
              url: job.job_apply_link ?? job.job_google_link,
              sourceName: asString(job.job_publisher) ? `JSearch / ${asString(job.job_publisher)}` : "JSearch",
              remoteHint: job.job_is_remote === true,
              salary:
                min !== undefined || max !== undefined
                  ? {
                      min,
                      max,
                      currency: asString(job.job_salary_currency),
                      period: period === "YEAR" ? "year" : period === "MONTH" ? "month" : period === "HOUR" ? "hour" : undefined,
                    }
                  : undefined,
            },
            now,
          );
        }),
      );
    },
  };
}
