import express, { Router } from "express";
import { env } from "../config/env.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import * as controller from "./career.controller.js";

// Every route requires a NEXUS session and is scoped to that user.

export const opportunitiesRouter = Router();
opportunitiesRouter.use(requireAuth);
opportunitiesRouter.get("/providers", controller.providerStatusHandler);
opportunitiesRouter.get("/", rateLimitPerUser({ windowMs: 60_000, max: 30 }), controller.searchOpportunitiesHandler);
opportunitiesRouter.get("/:jobId/match", controller.explainMatchHandler);

export const savedJobsRouter = Router();
savedJobsRouter.use(requireAuth);
savedJobsRouter.get("/", controller.listSavedJobsHandler);
savedJobsRouter.put("/:jobId", controller.putSavedJobHandler);
savedJobsRouter.delete("/:jobId", controller.deleteSavedJobHandler);

export const careerRouter = Router();
careerRouter.use(requireAuth);
careerRouter.get("/profile", controller.getCareerProfileHandler);
careerRouter.put("/preferences", controller.putPreferencesHandler);
careerRouter.put("/direction", controller.putDirectionHandler);
careerRouter.get("/transition", rateLimitPerUser({ windowMs: 60_000, max: 20 }), controller.getTransitionHandler);
careerRouter.put("/tasks/:skillId", controller.putTaskHandler);
// Fans out to GitHub: tight per-user limit.
careerRouter.post("/refresh", rateLimitPerUser({ windowMs: 10 * 60_000, max: 3 }), controller.refreshHandler);

export const resumeRouter = Router();
resumeRouter.use(requireAuth);
resumeRouter.get("/", controller.getResumeHandler);
resumeRouter.post(
  "/extract",
  rateLimitPerUser({ windowMs: 60_000, max: 10 }),
  // Only this route accepts a binary body, capped well below memory-pressure sizes.
  express.raw({ type: () => true, limit: env.RESUME_MAX_BYTES }),
  controller.extractResumeHandler,
);
resumeRouter.put("/", controller.replaceResumeHandler);
resumeRouter.delete("/", controller.deleteResumeHandler);

export const copilotRouter = Router();
copilotRouter.use(requireAuth);
copilotRouter.get("/prompts", controller.copilotPromptsHandler);
copilotRouter.post("/message", rateLimitPerUser({ windowMs: 60_000, max: 20 }), controller.copilotMessageHandler);
