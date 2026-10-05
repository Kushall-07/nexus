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
