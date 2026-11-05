import { Router } from "express";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import { createGapAnalysisHandler, explainGapAnalysisHandler, getGapAnalysisHandler } from "../controllers/roles.controller.js";

const router = Router();

router.use(requireAuth);

// Per-user, per-process limits. The explanation endpoint spends external LLM quota.
const explanationLimit = rateLimitPerUser({ windowMs: 60_000, max: 5 });
const createLimit = rateLimitPerUser({ windowMs: 60_000, max: 30 });

router.post("/", createLimit, createGapAnalysisHandler);
router.get("/:id", getGapAnalysisHandler);
router.post("/:id/explanation", explanationLimit, explainGapAnalysisHandler);

export default router;
