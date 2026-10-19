import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import {
  getSkillEvidenceHandler,
  getSkillHandler,
  listSkillsHandler,
} from "../controllers/skills.controller.js";

const router = Router();

// User-scoped reads: the skill overview and detail (Phase 6, backed by the
// persisted Phase 5 scoring result) and the evidence behind a skill (Phase 4).
router.use(requireAuth);

router.get("/", listSkillsHandler);
router.get("/:id", getSkillHandler);
router.get("/:id/evidence", getSkillEvidenceHandler);

export default router;
