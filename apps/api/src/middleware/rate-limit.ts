import type { NextFunction, Request, Response } from "express";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const registry: Map<string, Bucket>[] = [];

// Test hook: clears every limiter's counters.
export function resetRateLimits(): void {
  for (const buckets of registry) buckets.clear();
}

// Fixed-window limiter keyed by client IP.  State is held in this process only;
// with several API instances each enforces its own limit independently.
//
// req.ip is set by Express using the TRUST_PROXY setting (see app.ts / env.ts).
//   TRUST_PROXY=0 (default): socket address is used — safe, no header trust.
//   TRUST_PROXY=1: first X-Forwarded-For entry is trusted (single-proxy deployments).
// Set TRUST_PROXY to match your actual deployment topology to prevent spoofing.
//
// This limiter is appropriate for unauthenticated routes and as a global backstop.
export function rateLimitPerIp({ windowMs, max }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  registry.push(buckets);

  return function ipRateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    // req.ip honours the Express trust proxy setting — not raw header value.
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    // Drop expired buckets so the map cannot grow without bound.
    if (buckets.size > 50_000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    let bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      res.setHeader("Retry-After", String(retryAfter));
      throw new AppError(AuthErrorCode.RATE_LIMITED, 429, "Too many requests. Please try again shortly.", { retryAfter });
    }

    next();
  };
}

// Fixed-window limiter keyed by the authenticated user id. State is held in
// this process only: with several API instances each enforces its own limit.
// It must run after requireAuth; it never keys on IP (spoofable behind proxies).
export function rateLimitPerUser({ windowMs, max }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  registry.push(buckets);

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();

    if (!req.user) {
      throw new AppError(AuthErrorCode.UNAUTHORIZED, 401, "Authentication required.");
    }

    // Drop expired buckets so the map cannot grow without bound.
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    let bucket = buckets.get(req.user.id);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(req.user.id, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      res.setHeader("Retry-After", String(retryAfter));
      throw new AppError(AuthErrorCode.RATE_LIMITED, 429, "Too many requests. Please try again shortly.", { retryAfter });
    }

    next();
  };
}
