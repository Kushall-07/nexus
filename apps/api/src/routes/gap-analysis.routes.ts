import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { createGapAnalysisHandler, getGapAnalysisHandler } from "../controllers/roles.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createGapAnalysisHandler);
router.get("/:id", getGapAnalysisHandler);

export default router;
