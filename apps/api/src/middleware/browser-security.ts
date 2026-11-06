import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Sets defensive security headers on every API response.
//
// CSP note: this server delivers JSON and redirects only — no HTML that would
// execute scripts.  default-src 'none' blocks all content loading; frame-ancestors
// 'none' prevents clickjacking of any API response the browser may briefly render
// (e.g. the OAuth callback redirect page).
// The frontend SPA requires its own CSP configured at the static-hosting/CDN layer
// where index.html is served, not here.
//
// HSTS note: only sent in production where env validation already requires HTTPS.
// Local HTTP development is unaffected.  No includeSubDomains or preload until the
// deployment domain topology is confirmed.
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.removeHeader("X-Powered-By");

  // Clickjacking protection + restrictive fetch policy for JSON-only API responses.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");

  // Protocol-downgrade prevention — HTTPS only in production.
  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
}

// CSRF defence for cookie auth. Production cookies are SameSite=None, so a
// body-less cross-site POST (which skips CORS preflight) would carry the
// session. Browsers always send Origin on such requests: reject any
// state-changing request whose Origin is not the configured frontend.
// Requests without Origin (curl, server-to-server) are not browser CSRF vectors.
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");

  if (origin !== undefined && origin !== new URL(env.FRONTEND_URL).origin) {
    throw new AppError(AuthErrorCode.FORBIDDEN_ORIGIN, 403, "Request origin is not allowed.");
  }

  next();
}
