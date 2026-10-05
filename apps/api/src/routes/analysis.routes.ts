import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { analyzeRepositoryHandler } from "../controllers/analysis.controller.js";

const router = Router();

// Every Phase 3 analysis endpoint requires an authenticated NEXUS session.
// `POST /api/analysis/run` is reserved for the later full scoring/role-match
// pipeline; this router only exposes the bounded, Phase 3-scoped repository
// analyzer described in docs/implementation/phase3-repository-analyzer.md.
router.use(requireAuth);

router.post("/repositories/:id", analyzeRepositoryHandler);

export default router;
