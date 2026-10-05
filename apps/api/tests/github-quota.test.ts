import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { encryptToken } = await import("../src/utils/token-encryption.js");

const REAL_TOKEN = "gho_realGithubAccessToken";
const SESSION_TOKEN = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

function stubFetch(status: number, body: unknown, headers?: Record<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers })),
  );
}

describe("GET /api/github/quota", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    findByIdMock.mockReturnValue({ select: selectMock });
    selectMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
      encryptedGithubToken: encryptToken(REAL_TOKEN),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/github/quota");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns normalized quota data for an authenticated user", async () => {
    stubFetch(200, {
      resources: { core: { limit: 5000, remaining: 4721, reset: 1700000000 } },
    });

    const response = await request(app)
      .get("/api/github/quota")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        limit: 5000,
        remaining: 4721,
        resetAt: new Date(1700000000 * 1000).toISOString(),
      },
    });
  });

  it("never leaks the access token in the response", async () => {
    stubFetch(200, {
      resources: { core: { limit: 5000, remaining: 4721, reset: 1700000000 } },
    });

    const response = await request(app)
      .get("/api/github/quota")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(JSON.stringify(response.body)).not.toContain(REAL_TOKEN);
  });

  it("maps a GitHub rate-limit failure to GITHUB_RATE_LIMIT", async () => {
    stubFetch(403, { message: "rate limited" }, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1700000000",
    });

    const response = await request(app)
      .get("/api/github/quota")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("GITHUB_RATE_LIMIT");
    expect(response.body.error.remaining).toBe(0);
  });

  it("maps a GitHub auth failure to GITHUB_TOKEN_EXPIRED", async () => {
    stubFetch(401, { message: "Bad credentials" });

    const response = await request(app)
      .get("/api/github/quota")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("GITHUB_TOKEN_EXPIRED");
  });

  it("maps a GitHub network failure to GITHUB_SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const response = await request(app)
      .get("/api/github/quota")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_SERVICE_UNAVAILABLE");
  });
});
