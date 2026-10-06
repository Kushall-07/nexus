import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const evidenceFindMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));

vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: { find: (...args: unknown[]) => evidenceFindMock(...args) },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");

const USER_A = "507f1f77bcf86cd799439001";
const USER_B = "507f1f77bcf86cd799439002";
const REPOSITORY_ID = "507f1f77bcf86cd799439011";

function cookieFor(userId: string) {
  return `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: userId, githubId: "1" })}`;
}

function mockSessionUser(userId: string) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "octocat" });
}

// Simulates a collection holding evidence from two different users.
function stubEvidenceStore() {
  const store = [
    { userId: USER_A, repositoryId: REPOSITORY_ID, skillId: "react", evidenceType: "DEPENDENCY", signal: "dependency", value: "react", normalizedStrength: 1, sourcePath: "package.json", explanation: "A", evidenceKey: "a", detectedAt: new Date("2026-01-01T00:00:00Z") },
    { userId: USER_B, repositoryId: REPOSITORY_ID, skillId: "react", evidenceType: "DEPENDENCY", signal: "dependency", value: "react", normalizedStrength: 1, sourcePath: "package.json", explanation: "B", evidenceKey: "b", detectedAt: new Date("2026-01-01T00:00:00Z") },
  ];

  evidenceFindMock.mockImplementation((filter: { userId: string; skillId: string }) => ({
    sort: () => ({
      lean: async () => store.filter((row) => row.userId === filter.userId && row.skillId === filter.skillId),
    }),
  }));
}

describe("GET /api/skills/:id/evidence", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    evidenceFindMock.mockReset();
    stubEvidenceStore();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/skills/react/evidence");

    expect(response.status).toBe(401);
    expect(evidenceFindMock).not.toHaveBeenCalled();
  });

  it("returns only the authenticated user's evidence", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/skills/react/evidence").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data.skillId).toBe("react");
    expect(response.body.data.evidence).toHaveLength(1);
    expect(response.body.data.evidence[0].explanation).toBe("A");
    expect(JSON.stringify(response.body)).not.toContain(USER_A);
  });

  it("does not expose another user's evidence", async () => {
    mockSessionUser(USER_B);
    const response = await request(app).get("/api/skills/react/evidence").set("Cookie", cookieFor(USER_B));

    expect(response.body.data.evidence.map((item: { explanation: string }) => item.explanation)).toEqual(["B"]);
  });

  it("ignores any user id supplied by the client", async () => {
    mockSessionUser(USER_B);
    const response = await request(app)
      .get(`/api/skills/react/evidence?userId=${USER_A}`)
      .set("Cookie", cookieFor(USER_B));

    expect(evidenceFindMock).toHaveBeenCalledWith({ userId: USER_B, skillId: "react" });
    expect(response.body.data.evidence).toHaveLength(1);
  });

  it("returns SKILL_NOT_FOUND for skills outside the taxonomy", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/skills/cobol/evidence").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SKILL_NOT_FOUND");
  });

  it("validates the repositoryId filter", async () => {
    mockSessionUser(USER_A);
    const response = await request(app)
      .get("/api/skills/react/evidence?repositoryId=nope")
      .set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns an empty list when the user has no evidence for the skill", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/skills/docker/evidence").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data.evidence).toEqual([]);
  });
});
