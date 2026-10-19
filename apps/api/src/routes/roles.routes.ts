import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { getRoleHandler, listRolesHandler } from "../controllers/roles.controller.js";

const router = Router();

// The five manually curated v1 role benchmarks from config/roles.json.
router.use(requireAuth);

router.get("/", listRolesHandler);
router.get("/:id", getRoleHandler);

export default router;
