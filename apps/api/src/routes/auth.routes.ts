import { Router } from "express";
import { deleteAccount, githubCallback, githubLogin, logout, me } from "../controllers/auth.controller.js";
import { rateLimitPerIp, rateLimitPerUser } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

// OAuth initiation and callback share one IP-keyed limiter (20 req per 15 min).
// Combined: a legitimate user uses 1 initiation + 1 callback per OAuth flow, so
// 10 full flows per 15 min per IP is generous while blocking automated abuse.
const oauthLimit = rateLimitPerIp({ windowMs: 15 * 60_000, max: 20 });

router.get("/github", oauthLimit, githubLogin);
router.get("/github/callback", oauthLimit, githubCallback);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.delete("/account", requireAuth, rateLimitPerUser({ windowMs: 10 * 60_000, max: 3 }), deleteAccount);

export default router;
