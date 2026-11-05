import { env } from "../../config/env.js";
import type { JobSearchQuery, NormalizedJob } from "../types.js";
import { createAdzunaProvider, createJSearchProvider, createRemotiveProvider } from "./adapters.js";
import { createDemoProvider } from "./demo-provider.js";
import { ProviderError, type JobProvider, type ProviderStatus } from "./provider.js";
import { dedupeKey } from "./text.js";

export interface ProviderOutcome extends ProviderStatus {
  ok: boolean;
  count: number;
  errorKind?: string;
  errorMessage?: string;
  cached?: boolean;
}

export interface JobSearchResult {
  // "demo" results are invented fixtures and are never merged with live ones.
  mode: "live" | "demo";
  noProviderConfigured: boolean;
  providers: ProviderOutcome[];
  jobs: NormalizedJob[];
  retrievedAt: string;
}

interface CacheEntry {
  expiresAt: number;
  jobs: NormalizedJob[];
}

const MAX_CACHE_ENTRIES = 200;
const MAX_INDEX_ENTRIES = 1000;

export interface JobServiceOptions {
  liveProviders: JobProvider[];
  demoProvider?: JobProvider;
  cacheTtlMs: number;
  now?: () => Date;
}

export function createJobService(options: JobServiceOptions) {
  const demo = options.demoProvider ?? createDemoProvider();
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, CacheEntry>();
  // Recently returned jobs by internal id, so a result card can later be
  // explained or saved without trusting client-supplied job content.
  const index = new Map<string, NormalizedJob>();

  function remember(jobs: NormalizedJob[]) {
    for (const job of jobs) {
      index.delete(job.id);
      index.set(job.id, job);
    }
    while (index.size > MAX_INDEX_ENTRIES) index.delete(index.keys().next().value as string);
  }

  async function fromProvider(provider: JobProvider, query: JobSearchQuery): Promise<{ jobs: NormalizedJob[]; cached: boolean }> {
    const key = `${provider.id}|${JSON.stringify({ ...query })}`;
    const hit = cache.get(key);

    if (hit && hit.expiresAt > Date.now()) return { jobs: hit.jobs, cached: true };

    const jobs = await provider.search(query, now());

    if (options.cacheTtlMs > 0) {
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
      cache.set(key, { expiresAt: Date.now() + options.cacheTtlMs, jobs });
    }
    return { jobs, cached: false };
  }

  function dedupe(jobs: NormalizedJob[]): NormalizedJob[] {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = dedupeKey(job);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    providerStatuses(): ProviderStatus[] {
      return options.liveProviders.map((provider) => provider.status());
    },

    async search(query: JobSearchQuery, source: "live" | "demo"): Promise<JobSearchResult> {
      const retrievedAt = now().toISOString();

      if (source === "demo") {
        const jobs = await demo.search(query, now());
        remember(jobs);
        return {
          mode: "demo",
          noProviderConfigured: false,
          providers: [{ ...demo.status(), ok: true, count: jobs.length }],
          jobs,
          retrievedAt,
        };
      }

      const configured = options.liveProviders.filter((provider) => provider.status().configured);
      const notConfigured = options.liveProviders.filter((provider) => !provider.status().configured);

      const settled = await Promise.allSettled(configured.map((provider) => fromProvider(provider, query)));
      const outcomes: ProviderOutcome[] = notConfigured.map((provider) => ({ ...provider.status(), ok: false, count: 0 }));
      const collected: NormalizedJob[] = [];

      settled.forEach((result, position) => {
        const status = configured[position]!.status();

        if (result.status === "fulfilled") {
          collected.push(...result.value.jobs);
          outcomes.push({ ...status, ok: true, count: result.value.jobs.length, cached: result.value.cached });
        } else {
          const error = result.reason;
          const kind = error instanceof ProviderError ? error.kind : "upstream";
          // Only the failure category is logged and returned; never an upstream body or credential.
          console.error("Job provider failed:", { provider: status.id, kind });
          outcomes.push({
            ...status,
            ok: false,
            count: 0,
            errorKind: kind,
            errorMessage: error instanceof ProviderError ? error.message : "The job provider failed.",
          });
        }
      });

      // Providers filter unevenly; drop only listings whose KNOWN value contradicts the filter.
      const jobs = dedupe(collected)
        .filter(
          (job) =>
            (!query.workMode || !job.workMode || job.workMode === query.workMode) &&
            (!query.employmentType || !job.employmentType || job.employmentType === query.employmentType) &&
            (!query.experienceLevel || !job.experienceLevel || job.experienceLevel === query.experienceLevel),
        )
        .slice(0, query.limit);
      remember(jobs);

      return { mode: "live", noProviderConfigured: configured.length === 0, providers: outcomes, jobs, retrievedAt };
    },

    // Looks a job up among recently returned results.
    find(jobId: string): NormalizedJob | undefined {
      return index.get(jobId);
    },

    // Re-registers a stored snapshot (e.g. a saved job) for matching/explanation.
    adopt(job: NormalizedJob): void {
      if (!index.has(job.id)) remember([job]);
    },
  };
}

export type JobService = ReturnType<typeof createJobService>;

let defaultService: JobService | null = null;

export function getJobService(): JobService {
  if (!defaultService) {
    const deps = { timeoutMs: env.JOB_PROVIDER_TIMEOUT_MS };

    defaultService = createJobService({
      liveProviders: [
        createRemotiveProvider({ ...deps, enabled: env.REMOTIVE_ENABLED }),
        createAdzunaProvider({ ...deps, appId: env.ADZUNA_APP_ID, appKey: env.ADZUNA_APP_KEY, country: env.ADZUNA_COUNTRY }),
        createJSearchProvider({ ...deps, apiKey: env.JSEARCH_API_KEY }),
      ],
      cacheTtlMs: env.JOB_CACHE_TTL_SECONDS * 1000,
    });
  }
  return defaultService;
}

export function resetJobService(service?: JobService): void {
  defaultService = service ?? null;
}
