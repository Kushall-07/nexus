import { Router } from "express";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";
import {
  getQuota,
  getRepository,
  listRepositories,
  updateRepositorySelection,
} from "../controllers/github.controller.js";

const router = Router();

// Every Phase 2 GitHub endpoint requires an authenticated NEXUS session.
router.use(requireAuth);
// GitHub-backed endpoints spend the user's GitHub API quota. Per-user, per-process.
router.use(rateLimitPerUser({ windowMs: 60_000, max: 60 }));

router.get("/repos", listRepositories);
router.get("/repos/:id", getRepository);
router.patch("/repos/:id/selection", updateRepositorySelection);
router.get("/quota", getQuota);

export default router;
