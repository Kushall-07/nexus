import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { rateLimitPerUser } from "../src/middleware/rate-limit.js";

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
