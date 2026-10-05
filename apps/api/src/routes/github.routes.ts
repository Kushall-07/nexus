import { Router } from "express";
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

router.get("/repos", listRepositories);
router.get("/repos/:id", getRepository);
router.patch("/repos/:id/selection", updateRepositorySelection);
router.get("/quota", getQuota);

export default router;
