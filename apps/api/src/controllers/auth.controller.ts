import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  GITHUB_OAUTH_SCOPE,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clearedOauthStateCookieOptions,
  clearedSessionCookieOptions,
  oauthStateCookieOptions,
  sessionCookieOptions,
} from "../config/auth.config.js";
import {
  exchangeCodeForAccessToken,
  fetchGithubIdentity,
} from "../services/github-oauth.service.js";
import { createSessionToken } from "../services/session.service.js";
import { findSafeUserById, upsertUserFromGithub } from "../services/user.service.js";
import { generateOAuthState } from "../utils/oauth.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export function githubLogin(_req: Request, res: Response): void {
  const state = generateOAuthState();

  res.cookie(OAUTH_STATE_COOKIE_NAME, state, oauthStateCookieOptions);

  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizationUrl.searchParams.set(
    "redirect_uri",
    `${env.BACKEND_URL}/api/auth/github/callback`,
  );
  authorizationUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
  authorizationUrl.searchParams.set("state", state);

  res.redirect(authorizationUrl.toString());
}

export async function githubCallback(req: Request, res: Response): Promise<void> {
  const parseResult = callbackQuerySchema.safeParse(req.query);
  const storedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];

  res.clearCookie(OAUTH_STATE_COOKIE_NAME, clearedOauthStateCookieOptions);

  if (!parseResult.success) {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      400,
      "GitHub OAuth callback is missing required parameters.",
    );
  }

  const { code, state } = parseResult.data;

  if (typeof storedState !== "string" || storedState !== state) {
    throw new AppError(
      AuthErrorCode.INVALID_AUTH,
      400,
      "Invalid GitHub OAuth state.",
    );
  }

  const accessToken = await exchangeCodeForAccessToken(code);
  const identity = await fetchGithubIdentity(accessToken);
  const user = await upsertUserFromGithub(identity, accessToken);

  const sessionToken = createSessionToken({
    sub: user.id,
    githubId: user.githubId,
  });

  res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);

  res.redirect(env.FRONTEND_URL);
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Authentication required.",
    );
  }

  const user = await findSafeUserById(req.user.id);

  if (!user) {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Session user no longer exists.",
    );
  }

  res.status(200).json({
    success: true,
    data: {
      githubId: user.githubId,
      username: user.username,
    },
  });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, clearedSessionCookieOptions);

  res.status(200).json({
    success: true,
    data: { message: "Logged out successfully." },
  });
}
