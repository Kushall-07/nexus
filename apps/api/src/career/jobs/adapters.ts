import type { EmploymentType, ExperienceLevel, JobProviderId, JobSearchQuery, NormalizedJob } from "../types.js";
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
              salary: !predicted && (min !== undefined || max !== undefined) ? { min, max, currency: asString(job.currency), period: "year" } : undefined,
            },
            now,
          );
        }),
      );
    },
  };
}

// ---- Arbeitnow: free public API, no credentials; enabled by ARBEITNOW_ENABLED. ----
// job_types is a free-form array (e.g. ["Full Time"] or ["Mid", "fulltime fixed term"]);
// join as a single string so inferEmploymentType can scan it normally.
// created_at is a Unix timestamp in seconds – multiply by 1000 before passing to safeIsoDate.
export function createArbeitnowProvider(deps: ProviderDeps & { enabled: boolean }): JobProvider {
  return {
    id: "arbeitnow",
    label: "Arbeitnow",
    status: () => ({
      id: "arbeitnow",
      label: "Arbeitnow",
      configured: deps.enabled,
      hint: deps.enabled ? undefined : "Set ARBEITNOW_ENABLED=true to include Arbeitnow listings.",
    }),
    async search(query: JobSearchQuery, now: Date) {
      const params = new URLSearchParams({ page: String(query.page) });
      if (query.keywords) params.set("q", query.keywords);

      const body = asRecord(await fetchJson(`https://www.arbeitnow.com/api/job-board-api?${params}`, {}, { ...deps, maxBodyBytes: 5_000_000 }));
      if (!body || !Array.isArray(body.data)) throw new ProviderError("bad_response", "Unexpected Arbeitnow response.");

      return compact(
        body.data.slice(0, query.limit).map((entry) => {
          const job = asRecord(entry);
          if (!job) return null;

          // Convert seconds to milliseconds so safeIsoDate gets a valid epoch value.
          const createdAtMs = typeof job.created_at === "number" ? job.created_at * 1000 : job.created_at;
          const tags = list(job.tags).filter((t): t is string => typeof t === "string");
          const employmentHint = list(job.job_types)
            .filter((t): t is string => typeof t === "string")
            .join(" ") || undefined;

          return buildJob(
            {
              provider: "arbeitnow",
              providerJobId: asString(job.slug),
              title: asString(job.title),
              company: asString(job.company_name),
              descriptionHtml: asString(job.description),
              location: asString(job.location),
              tags,
              employmentHint,
              postedAt: createdAtMs,
              url: job.url,
              sourceName: "Arbeitnow",
              remoteHint: job.remote === true,
            },
            now,
          );
        }),
      );
    },
  };
}

// ---- Himalayas: free public API, no credentials; enabled by HIMALAYAS_ENABLED. ----
// Pagination: nextCursor proved unreliable in live testing — the cursor is ignored and
// offset-based pagination is used instead (offset = (page - 1) * 20).
// The server hard-caps responses at 20 results regardless of the `limit` param, so
// limit=20 is always sent and results are taken as-is.
// providerJobId: extracted from the GUID path as "{companySlug}/{jobSlug}"; the job
// slug alone is not unique across companies, but the combined form is.
// pubDate is Unix seconds — multiply by 1000 for safeIsoDate.
// locationRestrictions is an array of country names; joined as a comma-separated string.
// workMode is left to inferWorkMode on description + title rather than fabricated from
// the country list (Himalayas has no reliable remote boolean field).

const HIMALAYAS_EMPLOYMENT: Record<string, EmploymentType | undefined> = {
  "full time": "full-time",
  "part time": "part-time",
  contractor: "contract",
  temporary: "contract",
  freelance: "contract",
  internship: "internship",
};

const HIMALAYAS_SENIORITY: Record<string, ExperienceLevel | undefined> = {
  "entry-level": "entry",
  "mid-level": "mid",
  senior: "senior",
  director: "lead",
  executive: "lead",
  lead: "lead",
  vp: "lead",
  manager: "lead",
  internship: "intern",
};

function himalayasProviderJobId(guid: unknown): string | undefined {
  if (typeof guid !== "string") return undefined;
  try {
    // guid = "https://himalayas.app/companies/{companySlug}/jobs/{jobSlug}"
    const parts = new URL(guid).pathname.split("/").filter(Boolean);
    // ["companies", companySlug, "jobs", jobSlug]
    if (parts.length < 4 || parts[0] !== "companies" || parts[2] !== "jobs") return undefined;
    return `${parts[1]}/${parts[3]}`.slice(0, 200);
  } catch {
    return undefined;
  }
}

export function createHimalayasProvider(deps: ProviderDeps & { enabled: boolean }): JobProvider {
  return {
    id: "himalayas",
    label: "Himalayas",
    status: () => ({
      id: "himalayas",
      label: "Himalayas",
      configured: deps.enabled,
      hint: deps.enabled ? undefined : "Set HIMALAYAS_ENABLED=true to include Himalayas listings.",
    }),
    async search(query: JobSearchQuery, now: Date) {
      // nextCursor is not used: live testing showed it is unreliable.
      // offset-based pagination: each page fetches exactly 20 results.
      const offset = (query.page - 1) * 20;
      const params = new URLSearchParams({ limit: "20", offset: String(offset) });
      if (query.keywords) params.set("q", query.keywords);

      const body = asRecord(await fetchJson(`https://himalayas.app/jobs/api?${params}`, {}, deps));
      if (!body || !Array.isArray(body.jobs)) throw new ProviderError("bad_response", "Unexpected Himalayas response.");

      return compact(
        body.jobs.map((entry) => {
          const job = asRecord(entry);
          if (!job) return null;

          // Location: join country restriction list into a readable string.
          const locationParts = list(job.locationRestrictions).filter((c): c is string => typeof c === "string");
          const location = locationParts.length > 0 ? locationParts.join(", ") : undefined;

          // Employment type: normalize the Himalayas string to the NEXUS vocabulary.
          const empHint = typeof job.employmentType === "string" ? job.employmentType.toLowerCase() : "";
          const employmentType = HIMALAYAS_EMPLOYMENT[empHint];

          // Experience level from seniority array — used as a fallback when the title
          // gives no signal. buildJob infers from title first; we only override when that
          // returns undefined and Himalayas supplies a seniority value.
          const seniorityRaw = list(job.seniority).find((s): s is string => typeof s === "string") ?? "";
          const seniorityLevel = HIMALAYAS_SENIORITY[seniorityRaw.toLowerCase()];

          // Salary: only use stated values — never fabricate.
          const min = typeof job.minSalary === "number" ? job.minSalary : undefined;
          const max = typeof job.maxSalary === "number" ? job.maxSalary : undefined;
          const rawPeriod = typeof job.salaryPeriod === "string" ? job.salaryPeriod.toLowerCase() : "";
          const period: "year" | "month" | "hour" | undefined =
            rawPeriod === "annual" ? "year" : rawPeriod === "monthly" ? "month" : rawPeriod === "hourly" ? "hour" : undefined;
          const salary =
            min !== undefined || max !== undefined
              ? { min, max, currency: asString(job.currency), period }
              : undefined;

          // Categories: pass as tags to extractSkills; hyphens are stripped by canonicalSkillId.
          const tags = list(job.categories).filter((t): t is string => typeof t === "string");

          // pubDate is Unix seconds.
          const pubDateMs = typeof job.pubDate === "number" ? job.pubDate * 1000 : job.pubDate;

          const normalized = buildJob(
            {
              provider: "himalayas",
              providerJobId: himalayasProviderJobId(job.guid),
              title: asString(job.title),
              company: asString(job.companyName),
              descriptionHtml: asString(job.description),
              location,
              tags,
              // Pass the already-mapped type string; inferEmploymentType will recognise it.
              employmentHint: employmentType,
              postedAt: pubDateMs,
              url: job.applicationLink,
              sourceName: "Himalayas",
              // No reliable remote boolean on Himalayas; let inferWorkMode read the description.
              remoteHint: false,
              salary,
            },
            now,
          );

          // Augment with seniority-derived experience level only when title gives no signal.
          if (normalized && normalized.experienceLevel === undefined && seniorityLevel !== undefined) {
            return { ...normalized, experienceLevel: seniorityLevel };
          }
          return normalized;
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
                      period: period === "YEAR" ? "year" : period === "MONTH" ? "month" : period === "HOUR" ? "hour" : period === "WEEK" ? "week" : period === "DAY" ? "day" : undefined,
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
