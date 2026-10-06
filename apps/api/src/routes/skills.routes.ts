import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { getSkillEvidenceHandler } from "../controllers/skills.controller.js";

const router = Router();

// Phase 4 exposes only the user-scoped evidence read for a skill. The skill
// graph and score endpoints belong to later phases.
router.use(requireAuth);

router.get("/:id/evidence", getSkillEvidenceHandler);

export default router;
