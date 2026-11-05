import { z } from "zod";
import { CareerProfileModel } from "../models/career-profile.model.js";
import { SavedJobModel } from "../models/saved-job.model.js";
import {
  APPLICATION_STATUSES,
  TASK_STATUSES,
  preferencesSchema,
  resumeProfileSchema,
  type ApplicationStatus,
  type CareerPreferences,
  type NormalizedJob,
  type ResumeProfile,
  type TaskStatus,
} from "./types.js";

// The only module that touches the career collections. Every query is scoped
// by userId; callers never pass a document id from the client.

export interface StoredResume {
  profile: ResumeProfile;
  version: number;
  fileName: string | null;
  fileType: "pdf" | "docx" | null;
  savedAt: string;
}

export interface RefreshState {
  status: "idle" | "running" | "succeeded" | "failed";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface CareerProfile {
  preferences: CareerPreferences;
  resume: StoredResume | null;
  learning: { direction: string | null; tasks: Record<string, { status: TaskStatus; updatedAt: string }> };
  refresh: RefreshState;
}

export interface SavedJobRecord {
  jobId: string;
  job: NormalizedJob;
  status: ApplicationStatus;
  dismissed: boolean;
  note: string;
  statusDate: string | null;
  updatedAt: string;
}

const iso = (value: unknown): string | null => (value ? new Date(value as string | number | Date).toISOString() : null);

const storedResumeSchema = z.object({
  profile: resumeProfileSchema,
  version: z.number().int().min(1),
  fileName: z.string().nullable(),
  fileType: z.enum(["pdf", "docx"]).nullable(),
  savedAt: z.string(),
});

const tasksSchema = z.record(z.string(), z.object({ status: z.enum(TASK_STATUSES), updatedAt: z.string() }));

function defaults(): CareerProfile {
  return {
    preferences: preferencesSchema.parse({}),
    resume: null,
    learning: { direction: null, tasks: {} },
    refresh: { status: "idle", lastAttemptAt: null, lastSuccessAt: null, lastError: null },
  };
}

function toCareerProfile(doc: Record<string, any> | null): CareerProfile {
  if (!doc) return defaults();

  const preferences = preferencesSchema.safeParse(doc.preferences ?? {});
  const resume = doc.resume ? storedResumeSchema.safeParse(doc.resume) : null;
  const tasks = tasksSchema.safeParse(doc.learning?.tasks ?? {});

  return {
    preferences: preferences.success ? preferences.data : preferencesSchema.parse({}),
    resume: resume?.success ? resume.data : null,
    learning: { direction: doc.learning?.direction ?? null, tasks: tasks.success ? tasks.data : {} },
    refresh: {
      status: doc.refresh?.status ?? "idle",
      lastAttemptAt: iso(doc.refresh?.lastAttemptAt),
      lastSuccessAt: iso(doc.refresh?.lastSuccessAt),
      lastError: doc.refresh?.lastError ?? null,
    },
  };
}

export async function getCareerProfile(userId: string): Promise<CareerProfile> {
  return toCareerProfile(await CareerProfileModel.findOne({ userId }).lean());
}

async function patch(userId: string, set: Record<string, unknown>): Promise<void> {
  await CareerProfileModel.findOneAndUpdate({ userId }, { $set: set }, { upsert: true });
}

export async function savePreferences(userId: string, input: unknown): Promise<CareerPreferences> {
  const preferences = preferencesSchema.parse(input);
  await patch(userId, { preferences });
  return preferences;
}

// Replaces the active resume only with an already validated profile. The
// previous resume stays until this write succeeds (single atomic $set).
export async function replaceResume(
  userId: string,
  profileInput: unknown,
  meta: { fileName: string | null; fileType: "pdf" | "docx" | null },
): Promise<StoredResume> {
  const profile = resumeProfileSchema.parse(profileInput);
  const current = await getCareerProfile(userId);
  const resume: StoredResume = {
    profile,
    version: (current.resume?.version ?? 0) + 1,
    fileName: meta.fileName,
    fileType: meta.fileType,
    savedAt: new Date().toISOString(),
  };
  await patch(userId, { resume });
  return resume;
}

// Deletes only the resume. Preferences, learning progress, saved jobs and
// GitHub evidence are separate fields/collections and stay untouched.
export async function deleteResume(userId: string): Promise<boolean> {
  const current = await getCareerProfile(userId);
  if (!current.resume) return false;
  await patch(userId, { resume: null });
  return true;
}

export async function setDirection(userId: string, direction: string | null): Promise<void> {
  await patch(userId, { "learning.direction": direction });
}

const SKILL_ID = /^[a-z0-9-]{1,64}$/;

export async function setTaskStatus(userId: string, skillId: string, status: TaskStatus): Promise<void> {
  if (!SKILL_ID.test(skillId)) throw new Error("invalid skill id");
  z.enum(TASK_STATUSES).parse(status);
  await patch(userId, { [`learning.tasks.${skillId}`]: { status, updatedAt: new Date().toISOString() } });
}

export async function setRefreshState(userId: string, state: Partial<Record<keyof RefreshState, unknown>>): Promise<void> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) set[`refresh.${key}`] = value;
  await patch(userId, set);
}

// ----- Saved jobs -----

const MAX_STORED_DESCRIPTION = 2000;

function toSavedRecord(doc: Record<string, any>): SavedJobRecord {
  return {
    jobId: doc.jobId,
    job: doc.job as NormalizedJob,
    status: doc.status,
    dismissed: Boolean(doc.dismissed),
    note: doc.note ?? "",
    statusDate: iso(doc.statusDate),
    updatedAt: iso(doc.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listSavedJobs(userId: string): Promise<SavedJobRecord[]> {
  const docs = await SavedJobModel.find({ userId }).sort({ updatedAt: -1 }).lean();
  return docs.map((doc) => toSavedRecord(doc as Record<string, any>));
}

export const savedJobUpdateSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    note: z.string().max(2000).optional(),
    statusDate: z.string().datetime().nullable().optional(),
    dismissed: z.boolean().optional(),
  })
  .strict();

export type SavedJobUpdate = z.infer<typeof savedJobUpdateSchema>;

// Creates or updates the user's own record for a job. The snapshot is bounded.
export async function upsertSavedJob(userId: string, job: NormalizedJob, update: SavedJobUpdate): Promise<SavedJobRecord> {
  const snapshot = { ...job, description: job.description.slice(0, MAX_STORED_DESCRIPTION) };
  const set: Record<string, unknown> = {};
  if (update.status !== undefined) set.status = update.status;
  if (update.note !== undefined) set.note = update.note;
  if (update.statusDate !== undefined) set.statusDate = update.statusDate ? new Date(update.statusDate) : null;
  if (update.dismissed !== undefined) set.dismissed = update.dismissed;

  const operations: Record<string, unknown> = { $setOnInsert: { job: snapshot } };
  if (Object.keys(set).length > 0) operations.$set = set;

  const doc = await SavedJobModel.findOneAndUpdate({ userId, jobId: job.id }, operations, { upsert: true, returnDocument: "after" }).lean();

  return toSavedRecord(doc as Record<string, any>);
}

export async function updateSavedJob(userId: string, jobId: string, update: SavedJobUpdate): Promise<SavedJobRecord | null> {
  const set: Record<string, unknown> = {};
  if (update.status !== undefined) set.status = update.status;
  if (update.note !== undefined) set.note = update.note;
  if (update.statusDate !== undefined) set.statusDate = update.statusDate ? new Date(update.statusDate) : null;
  if (update.dismissed !== undefined) set.dismissed = update.dismissed;

  const doc = await SavedJobModel.findOneAndUpdate({ userId, jobId }, { $set: set }, { returnDocument: "after" }).lean();
  return doc ? toSavedRecord(doc as Record<string, any>) : null;
}

export async function deleteSavedJob(userId: string, jobId: string): Promise<boolean> {
  const result = await SavedJobModel.deleteOne({ userId, jobId });
  return result.deletedCount > 0;
}
