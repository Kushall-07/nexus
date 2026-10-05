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

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
  });

  it("returns UNAUTHORIZED when there is no session cookie", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns UNAUTHORIZED for an invalid session cookie", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=garbage-token`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns safe identity information for an authenticated request", async () => {
    findByIdMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });

    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ githubId: "42", username: "octocat" });
  });

  it("never returns the GitHub token, encrypted token, or JWT in the response", async () => {
    findByIdMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });

    const token = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain("encryptedGithubToken");
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain(token);
  });

  it("returns UNAUTHORIZED when the session user no longer exists", async () => {
    findByIdMock.mockResolvedValue(null);

    const token = createSessionToken({ sub: "deleted-user-id", githubId: "42" });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});
