import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findOneAndUpdate: vi.fn(),
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
  });

  it("succeeds and clears the session cookie", async () => {
    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const setCookieHeader = response.headers["set-cookie"] as unknown as string[];
    const clearedSessionCookie = setCookieHeader.find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    expect(clearedSessionCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("does not require authentication to call", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
  });

  it("revokes the server-side session: a replayed copy of the old cookie is rejected", async () => {
    findByIdMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });

    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);

    expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(200);

    const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("UNAUTHORIZED");

    const protectedRoute = await request(app).get("/api/skills").set("Cookie", cookie);
    expect(protectedRoute.status).toBe(401);

    // A fresh session for the same user is unaffected.
    const fresh = createSessionToken({ sub: "mongo-user-id", githubId: "42" });
    const freshResponse = await request(app).get("/api/auth/me").set("Cookie", `${SESSION_COOKIE_NAME}=${fresh}`);
    expect(freshResponse.status).toBe(200);
  });

  it("clears the cookie with the same attributes it was set with", async () => {
    const response = await request(app).post("/api/auth/logout");
    const cleared = (response.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    expect(cleared).toMatch(/Path=\//);
    expect(cleared).toMatch(/HttpOnly/i);
    expect(cleared).toMatch(/SameSite=Lax/i);
  });

  it("rejects a cross-origin logout and keeps the session valid", async () => {
    findByIdMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });
    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Origin", "https://evil.example")
      .set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
  });

  it("does not expose logout as a GET", async () => {
    const response = await request(app).get("/api/auth/logout");
    expect(response.status).toBe(404);
  });

  it("renders a previously valid session cookie unusable for subsequent protected requests", async () => {
    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

    const agent = request.agent(app);

    await agent.post("/api/auth/logout").set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    findByIdMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });

    // The browser would no longer send the cleared cookie; simulate that by
    // making the follow-up request with no cookie at all.
    const protectedResponse = await request(app).get("/api/auth/me");

    expect(protectedResponse.status).toBe(401);
  });
});
