import { AppError, AuthErrorCode } from "../utils/errors.js";
import { listSavedJobs, type SavedJobRecord } from "./career-store.js";
import { getJobService, type JobSearchResult } from "./jobs/job-service.js";
import { matchJob, rankMatches, type JobMatch } from "./matching/job-matcher.js";
import { loadProfileContext, type ProfileContext } from "./profile.service.js";
import type { JobSearchQuery, NormalizedJob } from "./types.js";

export interface OpportunityItem {
  job: NormalizedJob;
  match: JobMatch;
  saved: { status: SavedJobRecord["status"]; note: string; statusDate: string | null } | null;
}

export interface OpportunitySearch {
  mode: JobSearchResult["mode"];
  noProviderConfigured: boolean;
  providers: JobSearchResult["providers"];
  retrievedAt: string;
  profile: ProfileContext["meta"];
  items: OpportunityItem[];
  dismissedCount: number;
}

export async function searchOpportunities(
  userId: string,
  query: JobSearchQuery,
  source: "live" | "demo",
): Promise<OpportunitySearch> {
  const [result, context, saved] = await Promise.all([
    getJobService().search(query, source),
    loadProfileContext(userId),
    listSavedJobs(userId),
  ]);

  const savedById = new Map(saved.map((record) => [record.jobId, record]));
  const visible = result.jobs.filter((job) => !savedById.get(job.id)?.dismissed);

  const items = rankMatches(
    visible.map((job) => {
      const record = savedById.get(job.id);
      return {
        job,
        match: matchJob(job, context.match),
        saved: record && record.status ? { status: record.status, note: record.note, statusDate: record.statusDate } : null,
      };
    }),
  );

  return {
    mode: result.mode,
    noProviderConfigured: result.noProviderConfigured,
    providers: result.providers,
    retrievedAt: result.retrievedAt,
    profile: context.meta,
    items,
    dismissedCount: result.jobs.length - visible.length,
  };
}

// Resolves a job the user may reference: a recent search result, or one of
// their own saved snapshots. Nothing client-supplied is trusted as job content.
export async function resolveJob(userId: string, jobId: string): Promise<NormalizedJob> {
  const service = getJobService();
  const recent = service.find(jobId);
  if (recent) return recent;

  const saved = (await listSavedJobs(userId)).find((record) => record.jobId === jobId);
  if (saved) {
    service.adopt(saved.job);
    return saved.job;
  }
  throw new AppError(AuthErrorCode.JOB_NOT_FOUND, 404, "Job not found. Run a search again to refresh it.");
}

export async function explainJobMatch(userId: string, jobId: string): Promise<{ job: NormalizedJob; match: JobMatch }> {
  const [job, context] = await Promise.all([resolveJob(userId, jobId), loadProfileContext(userId)]);
  return { job, match: matchJob(job, context.match) };
}
