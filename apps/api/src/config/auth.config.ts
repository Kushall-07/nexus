import type { CookieOptions } from "express";
import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production";

export const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
export const SESSION_COOKIE_NAME = "nexus_session";
export const GITHUB_OAUTH_SCOPE = "read:user user:email";
export const SESSION_TOKEN_EXPIRES_IN = "7d";

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Cross-site cookies (prod, separate frontend/backend domains) require
// SameSite=None+Secure; same-site localhost dev needs Lax so it works over http.
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

export const oauthStateCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: OAUTH_STATE_MAX_AGE_MS,
};

export const clearedOauthStateCookieOptions: CookieOptions = {
  ...baseCookieOptions,
};

export const sessionCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: SESSION_MAX_AGE_MS,
};

export const clearedSessionCookieOptions: CookieOptions = {
  ...baseCookieOptions,
};
