import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// This API only serves JSON, so these headers cannot break the SPA, OAuth
// redirects or the Vite dev proxy.
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.removeHeader("X-Powered-By");
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
