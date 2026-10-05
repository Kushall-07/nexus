import { Router } from "express";
import { githubCallback, githubLogin, logout, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
