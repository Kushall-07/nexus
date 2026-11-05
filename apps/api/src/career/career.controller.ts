import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import {
  deleteResume,
  deleteSavedJob,
  getCareerProfile,
  listSavedJobs,
  replaceResume,
  savedJobUpdateSchema,
  savePreferences,
  setTaskStatus,
  updateSavedJob,
  upsertSavedJob,
} from "./career-store.js";
import { handleCopilotMessage, SUGGESTED_PROMPTS } from "./copilot/copilot.service.js";
import { copilotRequestSchema } from "./copilot/intent.js";
import { getJobService } from "./jobs/job-service.js";
import { explainJobMatch, resolveJob, searchOpportunities } from "./opportunities.service.js";
import { loadProfileContext } from "./profile.service.js";
import { refreshGithubProfile } from "./refresh.service.js";
import { extractResumeProfile } from "./resume/extractor.js";
import { detectResumeType, extractResumeText } from "./resume/upload.js";
import { buildTransitionPlan, changeDirection, listDirections } from "./transition/transition.service.js";
import { TASK_STATUSES, jobSearchQuerySchema, preferencesSchema, resumeProfileSchema } from "./types.js";

function requireUser(req: Request) {
  if (!req.user) throw new AppError(AuthErrorCode.UNAUTHORIZED, 401, "Authentication required.");
  return req.user;
}

const invalid = () => new AppError(AuthErrorCode.VALIDATION_ERROR, 400, "Invalid request.");
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });

const jobIdSchema = z.string().min(3).max(300).regex(/^[a-z]+:[A-Za-z0-9_.:\-]{1,250}$/);
const skillIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalid();
  return result.data;
}

// ----- Opportunities -----

export async function searchOpportunitiesHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { source, ...query } = parse(jobSearchQuerySchema, req.query);
  ok(res, await searchOpportunities(user.id, query, source));
}

export function providerStatusHandler(req: Request, res: Response) {
  requireUser(req);
  ok(res, {
    providers: getJobService().providerStatuses(),
    // Booleans only: whether optional LLM interpretation is set up, never the key or model.
    llm: { configured: Boolean(env.LLM_PROVIDER && env.LLM_API_KEY) },
  });
}

export async function explainMatchHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const jobId = parse(jobIdSchema, req.params.jobId);
  ok(res, await explainJobMatch(user.id, jobId));
}

// ----- Saved jobs / application tracking -----

export async function listSavedJobsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  ok(res, { items: await listSavedJobs(user.id) });
}

// Creates the user's record on first use (the job content comes from the
// server's own search results, never from the request body) and updates it afterwards.
export async function putSavedJobHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const jobId = parse(jobIdSchema, req.params.jobId);
  const update = parse(savedJobUpdateSchema, req.body ?? {});

  const existing = await updateSavedJob(user.id, jobId, update);
  if (existing) return ok(res, existing);

  const job = await resolveJob(user.id, jobId);
  ok(res, await upsertSavedJob(user.id, job, update), 201);
}

export async function deleteSavedJobHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const jobId = parse(jobIdSchema, req.params.jobId);
  if (!(await deleteSavedJob(user.id, jobId))) throw new AppError(AuthErrorCode.JOB_NOT_FOUND, 404, "Saved job not found.");
  ok(res, { deleted: true });
}

// ----- Career profile, direction, tasks, refresh -----

export async function getCareerProfileHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const context = await loadProfileContext(user.id);
  ok(res, {
    preferences: context.career.preferences,
    resume: context.career.resume,
    learning: context.career.learning,
    refresh: context.career.refresh,
    evidence: context.meta,
    directions: listDirections(),
    llmConfigured: Boolean(env.LLM_PROVIDER && env.LLM_API_KEY),
  });
}

export async function putPreferencesHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const preferences = parse(preferencesSchema, req.body);
  // Directions are a controlled vocabulary.
  const known = new Set(listDirections().map((direction) => direction.id));
  if (preferences.directions.some((id) => !known.has(id))) throw invalid();
  ok(res, await savePreferences(user.id, preferences));
}

export async function putDirectionHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { directionId } = parse(z.object({ directionId: z.string().min(1).max(64).nullable() }).strict(), req.body);
  ok(res, { directionId: await changeDirection(user.id, directionId) });
}

export async function getTransitionHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const query = parse(
    z.object({ direction: z.string().min(1).max(64).optional(), source: z.enum(["live", "demo"]).optional() }).strict(),
    req.query,
  );
  ok(res, await buildTransitionPlan(user.id, { directionId: query.direction, source: query.source }));
}

export async function putTaskHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const skillId = parse(skillIdSchema, req.params.skillId);
  const { status } = parse(z.object({ status: z.enum(TASK_STATUSES) }).strict(), req.body);
  await setTaskStatus(user.id, skillId, status);
  ok(res, { skillId, status });
}

export async function refreshHandler(req: Request, res: Response) {
  const user = requireUser(req);
  ok(res, await refreshGithubProfile(user.id));
}

// ----- Resume -----

export async function getResumeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  ok(res, { resume: (await getCareerProfile(user.id)).resume, maxBytes: env.RESUME_MAX_BYTES });
}

function safeFileName(header: unknown): string {
  let name = typeof header === "string" ? header : "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  // eslint-disable-next-line no-control-regex
  return name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, "").slice(0, 100);
}

// Produces a DRAFT only. Nothing is stored; the file and its text are discarded
// when the response is sent.
export async function extractResumeHandler(req: Request, res: Response) {
  requireUser(req);
  const body = req.body as unknown;

  if (!Buffer.isBuffer(body)) {
    throw new AppError(AuthErrorCode.UNSUPPORTED_FILE, 415, "Send the file as the raw request body (PDF or DOCX).");
  }

  const fileName = safeFileName(req.get("x-file-name"));
  const type = detectResumeType(body, fileName);
  const text = await extractResumeText(body, type);

  ok(res, { fileName, fileType: type, profile: extractResumeProfile(text) });
}

const replaceResumeSchema = z
  .object({
    profile: resumeProfileSchema,
    fileName: z.string().max(100).nullable().default(null),
    fileType: z.enum(["pdf", "docx"]).nullable().default(null),
  })
  .strict();

export async function replaceResumeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const body = parse(replaceResumeSchema, req.body);
  ok(res, await replaceResume(user.id, body.profile, { fileName: body.fileName, fileType: body.fileType }));
}

export async function deleteResumeHandler(req: Request, res: Response) {
  const user = requireUser(req);
  if (!(await deleteResume(user.id))) throw new AppError(AuthErrorCode.RESUME_NOT_FOUND, 404, "No resume to delete.");
  ok(res, { deleted: true });
}

// ----- Copilot -----

export async function copilotMessageHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const body = parse(copilotRequestSchema, req.body);
  ok(res, await handleCopilotMessage(user.id, body));
}

export function copilotPromptsHandler(req: Request, res: Response) {
  requireUser(req);
  ok(res, { prompts: SUGGESTED_PROMPTS });
}
