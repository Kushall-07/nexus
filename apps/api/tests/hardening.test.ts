import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { rateLimitPerIp, rateLimitPerUser } from "../src/middleware/rate-limit.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("liveness and readiness", () => {
  it("/ready reports 503 while MongoDB is not connected and 200 once it is", async () => {
    const state = vi.spyOn(mongoose.connection, "readyState", "get");

    state.mockReturnValue(0);
    const down = await request(app).get("/ready");
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ status: "unavailable", service: "nexus-api" });

    state.mockReturnValue(1);
    const up = await request(app).get("/ready");
    expect(up.status).toBe(200);
    expect(up.body).toEqual({ status: "ready", service: "nexus-api" });
  });

  it("/health stays a dependency-free liveness check", async () => {
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);
    expect((await request(app).get("/health")).status).toBe(200);
  });
});

describe("browser-facing security", () => {
  it("sets defensive headers and does not advertise Express", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets Content-Security-Policy with default-src none and frame-ancestors none", async () => {
    const response = await request(app).get("/health");
    const csp = response.headers["content-security-policy"] as string;

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("omits Strict-Transport-Security in test/development (NODE_ENV=test)", async () => {
    // HSTS must not be sent over non-HTTPS local dev connections.
    const response = await request(app).get("/health");
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sets Strict-Transport-Security with one-year max-age in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://app.example.com");
    vi.stubEnv("BACKEND_URL", "https://api.example.com");
    vi.resetModules();

    // Re-import the middleware with the production env.
    const { securityHeaders: prodHeaders } = await import("../src/middleware/browser-security.js");

    const testApp = express();
    testApp.use(prodHeaders);
    testApp.get("/t", (_req, res) => res.json({ ok: true }));

    const response = await request(testApp).get("/t");
    expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
  });

  it("rejects state-changing requests from a foreign Origin before auth runs", async () => {
    const response = await request(app).post("/api/analysis/run").set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("lets the configured frontend origin through to normal auth handling", async () => {
    const response = await request(app).post("/api/analysis/run").set("Origin", new URL(env.FRONTEND_URL).origin);

    expect(response.status).toBe(401);
  });

  it("does not block safe methods or requests without an Origin header", async () => {
    expect((await request(app).get("/api/auth/me").set("Origin", "https://evil.example")).status).toBe(401);
    expect((await request(app).post("/api/analysis/run")).status).toBe(401);
  });
});

describe("request body handling", () => {
  it("maps malformed JSON to a 400 validation error without leaking parser details", async () => {
    const response = await request(app).post("/api/gap-analysis").set("Content-Type", "application/json").send("{not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } });
  });

  it("rejects an oversized JSON body with 413", async () => {
    const response = await request(app).post("/api/gap-analysis").send({ roleId: "x".repeat(40_000) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("unexpected errors", () => {
  it("returns a generic 500 with no stack, message or secret", async () => {
    const boom = express();
    boom.get("/boom", () => {
      throw new Error("connect mongodb://user:hunter2@db:27017 failed at C:\\secret\\path.ts");
    });
    boom.use(errorHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(boom).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    expect(JSON.stringify(response.body)).not.toMatch(/hunter2|secret|stack/);
  });
});

describe("per-user rate limiting", () => {
  function limitedApp() {
    const limited = express();
    limited.use((req, _res, next) => {
      req.user = { id: String(req.get("x-user")), githubId: "1" };
      next();
    });
    limited.get("/x", rateLimitPerUser({ windowMs: 60_000, max: 2 }), (_req, res) => {
      res.json({ success: true, data: {} });
    });
    limited.use(errorHandler);
    return limited;
  }

  it("allows up to the limit then returns a safe 429 with Retry-After", async () => {
    const limited = limitedApp();

    expect((await request(limited).get("/x").set("x-user", "a")).status).toBe(200);
    expect((await request(limited).get("/x").set("x-user", "a")).status).toBe(200);

    const blocked = await request(limited).get("/x").set("x-user", "a");

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("keys on the authenticated user so one user cannot exhaust another's allowance", async () => {
    const limited = limitedApp();

    for (let i = 0; i < 3; i++) await request(limited).get("/x").set("x-user", "a");

    expect((await request(limited).get("/x").set("x-user", "b")).status).toBe(200);
  });

  it("resets after the window", async () => {
    const limited = limitedApp();
    const now = Date.now();

    for (let i = 0; i < 3; i++) await request(limited).get("/x").set("x-user", "a");
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);

    expect((await request(limited).get("/x").set("x-user", "a")).status).toBe(200);
  });
});

describe("per-IP rate limiting", () => {
  // Create a test app with trust proxy enabled so X-Forwarded-For can be used
  // to simulate distinct client IPs without needing real network connections.
  function ipLimitedApp() {
    const limited = express();
    limited.set("trust proxy", 1);
    limited.use(rateLimitPerIp({ windowMs: 60_000, max: 2 }));
    limited.get("/x", (_req, res) => res.json({ success: true, data: {} }));
    limited.use(errorHandler);
    return limited;
  }

  it("allows requests up to the limit then returns 429 with Retry-After", async () => {
    const limited = ipLimitedApp();

    expect((await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.1")).status).toBe(200);
    expect((await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.1")).status).toBe(200);

    const blocked = await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.1");

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("keys on the IP so one client cannot exhaust another's allowance", async () => {
    const limited = ipLimitedApp();

    // Exhaust 10.0.0.2
    for (let i = 0; i < 3; i++) await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.2");

    // 10.0.0.3 is still within its own limit
    expect((await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.3")).status).toBe(200);
  });

  it("resets after the window using a time mock", async () => {
    const limited = ipLimitedApp();
    const now = Date.now();

    for (let i = 0; i < 3; i++) await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.4");
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);

    expect((await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.4")).status).toBe(200);
  });

  it("returns a safe 429 JSON body consistent with application error conventions", async () => {
    const limited = ipLimitedApp();

    for (let i = 0; i < 3; i++) await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.5");

    const blocked = await request(limited).get("/x").set("X-Forwarded-For", "10.0.0.5");

    expect(blocked.body).toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED", message: expect.any(String) },
    });
  });

  it("with TRUST_PROXY=0 a spoofed X-Forwarded-For header does not reset the rate-limiter key", async () => {
    // With trust proxy disabled (default), Express derives req.ip from the
    // socket address only — the X-Forwarded-For header is ignored entirely.
    // All supertest requests originate from the same loopback socket address,
    // so the first two requests exhaust the limit for that socket IP, and a
    // third request spoofing a different IP is still blocked.
    const limited = express();
    limited.set("trust proxy", 0);
    limited.use(rateLimitPerIp({ windowMs: 60_000, max: 2 }));
    limited.get("/x", (_req, res) => res.json({ success: true, data: {} }));
    limited.use(errorHandler);

    // Exhaust the limit using the actual socket IP (no X-Forwarded-For header).
    expect((await request(limited).get("/x")).status).toBe(200);
    expect((await request(limited).get("/x")).status).toBe(200);

    // A third request with a spoofed header claiming a fresh IP is still blocked
    // because trust proxy=0 means Express ignores X-Forwarded-For and continues
    // to use the socket address, which is already over the limit.
    const spoofed = await request(limited).get("/x").set("X-Forwarded-For", "1.2.3.4");
    expect(spoofed.status).toBe(429);
    expect(spoofed.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("environment validation", () => {
  async function loadEnv() {
    vi.resetModules();
    return import("../src/config/env.js");
  }

  it("rejects an unknown LLM_PROVIDER by naming the setting", async () => {
    vi.stubEnv("LLM_PROVIDER", "bogus-provider");

    await expect(loadEnv()).rejects.toThrow(/LLM_PROVIDER/);
  });

  it("requires base URL and model for openai-compatible, but keeps the LLM optional otherwise", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai-compatible");
    vi.stubEnv("LLM_BASE_URL", "");
    vi.stubEnv("LLM_MODEL", "");
    await expect(loadEnv()).rejects.toThrow(/LLM_BASE_URL/);

    vi.stubEnv("LLM_PROVIDER", "");
    await expect(loadEnv()).resolves.toBeDefined();
  });

  it("rejects an out-of-range PORT and a malformed encryption key", async () => {
    vi.stubEnv("PORT", "70000");
    await expect(loadEnv()).rejects.toThrow(/PORT/);

    vi.stubEnv("PORT", "4000");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "c2hvcnQ=");
    await expect(loadEnv()).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("requires https URLs in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "http://app.example.com");

    await expect(loadEnv()).rejects.toThrow(/FRONTEND_URL/);
  });
});

describe("E2E rate-limit isolation", () => {
  // Reloads env.ts with the current process.env stubs.
  async function loadEnv() {
    vi.resetModules();
    return import("../src/config/env.js");
  }

  // ── Configuration validation ───────────────────────────────────────────────

  it("accepts E2E_RATE_LIMIT_MAX in test mode with a valid value", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "1500");
    const { env: testEnv } = await loadEnv();
    expect(testEnv.E2E_RATE_LIMIT_MAX).toBe(1500);
  });

  it("is absent (undefined) in test mode when not set — production default 500 applies", async () => {
    vi.stubEnv("NODE_ENV", "test");
    // E2E_RATE_LIMIT_MAX deliberately not stubbed — should be absent from process.env
    const { env: testEnv } = await loadEnv();
    expect(testEnv.E2E_RATE_LIMIT_MAX).toBeUndefined();
  });

  it("rejects E2E_RATE_LIMIT_MAX when NODE_ENV=production — production cannot enable the override", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://app.example.com");
    vi.stubEnv("BACKEND_URL", "https://api.example.com");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "5000");
    await expect(loadEnv()).rejects.toThrow(/E2E_RATE_LIMIT_MAX/);
  });

  it("rejects E2E_RATE_LIMIT_MAX when NODE_ENV=development — development does not inherit the override", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "5000");
    await expect(loadEnv()).rejects.toThrow(/E2E_RATE_LIMIT_MAX/);
  });

  it("rejects zero as E2E_RATE_LIMIT_MAX (must be at least 1)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "0");
    await expect(loadEnv()).rejects.toThrow(/E2E_RATE_LIMIT_MAX/);
  });

  it("rejects values above 10 000 as unreasonable", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "10001");
    await expect(loadEnv()).rejects.toThrow(/E2E_RATE_LIMIT_MAX/);
  });

  it("rejects a non-numeric E2E_RATE_LIMIT_MAX value", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_RATE_LIMIT_MAX", "not-a-number");
    await expect(loadEnv()).rejects.toThrow(/E2E_RATE_LIMIT_MAX/);
  });

  // ── Middleware behaviour ───────────────────────────────────────────────────
  // These tests use fresh rateLimitPerIp instances (same as the per-IP suite
  // above) to prove the limiter still fires at the configured ceiling — the
  // E2E override does not bypass rate-limiting, it only raises the threshold.

  it("rate limiting still enforces the configured test ceiling — 429 fires after the limit", async () => {
    const limited = express();
    limited.set("trust proxy", 1);
    // max=3 simulates a low E2E_RATE_LIMIT_MAX; proves the guard still fires.
    limited.use(rateLimitPerIp({ windowMs: 60_000, max: 3 }));
    limited.get("/x", (_req, res) => res.json({ success: true, data: {} }));
    limited.use(errorHandler);

    for (let i = 0; i < 3; i++) {
      expect(
        (await request(limited).get("/x").set("X-Forwarded-For", "10.100.0.1")).status,
      ).toBe(200);
    }

    const blocked = await request(limited).get("/x").set("X-Forwarded-For", "10.100.0.1");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("TRUST_PROXY=0 — spoofed X-Forwarded-For cannot circumvent a raised test limit", async () => {
    // With trust proxy disabled, Express ignores X-Forwarded-For regardless of
    // the configured max.  All requests key on the socket address; a header
    // claiming a fresh IP after exhaustion is still blocked.
    const limited = express();
    limited.set("trust proxy", 0);
    limited.use(rateLimitPerIp({ windowMs: 60_000, max: 3 }));
    limited.get("/x", (_req, res) => res.json({ success: true, data: {} }));
    limited.use(errorHandler);

    for (let i = 0; i < 3; i++) {
      expect((await request(limited).get("/x")).status).toBe(200);
    }

    // Spoofed header claiming a new IP — still blocked because socket IP is used.
    const spoofed = await request(limited).get("/x").set("X-Forwarded-For", "10.200.0.1");
    expect(spoofed.status).toBe(429);
    expect(spoofed.body.error.code).toBe("RATE_LIMITED");
  });
});
