import { Router } from "express";
import { env } from "../config/env.js";
import { generateOAuthState } from "../utils/oauth.js";

const router = Router();

router.get("/github", (req, res) => {
  const state = generateOAuthState();

  res.cookie("github_oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const githubAuthorizationUrl = new URL(
    "https://github.com/login/oauth/authorize",
  );

  githubAuthorizationUrl.searchParams.set(
    "client_id",
    env.GITHUB_CLIENT_ID,
  );

  githubAuthorizationUrl.searchParams.set(
    "redirect_uri",
    `${env.BACKEND_URL}/api/auth/github/callback`,
  );

  githubAuthorizationUrl.searchParams.set(
    "scope",
    "read:user user:email",
  );

  githubAuthorizationUrl.searchParams.set("state", state);

  res.redirect(githubAuthorizationUrl.toString());
});

export default router;
