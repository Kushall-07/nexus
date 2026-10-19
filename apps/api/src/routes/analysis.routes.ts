import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { analyzeRepositoryHandler, runScoringHandler } from "../controllers/analysis.controller.js";

const router = Router();

// Every Phase 3 analysis endpoint requires an authenticated NEXUS session.
// `POST /api/analysis/repositories/:id` is the bounded Phase 3 repository
// analyzer (docs/implementation/phase3-repository-analyzer.md).
// `POST /api/analysis/run` scores the user's already-persisted evidence (Phase 5).
router.use(requireAuth);

router.post("/repositories/:id", analyzeRepositoryHandler);
router.post("/run", runScoringHandler);

export default router;
