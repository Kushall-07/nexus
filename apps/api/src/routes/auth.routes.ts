import { Router } from "express";
import { deleteAccount, githubCallback, githubLogin, logout, me } from "../controllers/auth.controller.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.delete("/account", requireAuth, rateLimitPerUser({ windowMs: 10 * 60_000, max: 3 }), deleteAccount);

export default router;
