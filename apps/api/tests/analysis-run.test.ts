import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const scoreMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));
vi.mock("../src/services/scoring.service.js", () => ({
  scoreUserEvidence: (...args: unknown[]) => scoreMock(...args),
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { AppError, AuthErrorCode } = await import("../src/utils/errors.js");

const USER = "507f1f77bcf86cd799439001";
const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: USER, githubId: "1" })}`;

describe("POST /api/analysis/run", () => {
  beforeEach(() => {
    findByIdMock.mockReset().mockReturnValue({ select: selectMock });
    selectMock.mockReset().mockResolvedValue({ _id: { toString: () => USER }, githubId: "1", username: "octocat" });
    scoreMock.mockReset();
  });

  it("requires authentication", async () => {
    const response = await request(app).post("/api/analysis/run");

    expect(response.status).toBe(401);
    expect(scoreMock).not.toHaveBeenCalled();
  });

  it("scores the session user's evidence and returns a summary without the score payload", async () => {
    scoreMock.mockResolvedValue({
      analysisId: "analysis-1",
      scoringVersion: "1.0.0",
      repositoryIds: ["a", "b"],
      skippedRepositoryIds: ["c"],
      evidenceCount: 9,
      result: { skillScores: [{}, {}, {}] },
    });
    const response = await request(app).post("/api/analysis/run").set("Cookie", cookie);

    expect(scoreMock).toHaveBeenCalledWith(USER);
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      analysisId: "analysis-1",
      scoringVersion: "1.0.0",
      repositoryCount: 2,
      skippedRepositoryCount: 1,
      evidenceCount: 9,
      scoredSkillCount: 3,
    });
  });

  it("surfaces NO_EVIDENCE in the standard error format", async () => {
    scoreMock.mockRejectedValue(new AppError(AuthErrorCode.NO_EVIDENCE, 404, "No evidence is available to score."));
    const response = await request(app).post("/api/analysis/run").set("Cookie", cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NO_EVIDENCE");
  });
});
