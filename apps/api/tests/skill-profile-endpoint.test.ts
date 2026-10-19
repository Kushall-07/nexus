import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const analysisFindOneMock = vi.fn();
const repositoryFindMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));
vi.mock("../src/models/analysis.model.js", () => ({
  AnalysisModel: { findOne: (...args: unknown[]) => analysisFindOneMock(...args) },
}));
vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: { find: (...args: unknown[]) => repositoryFindMock(...args) },
}));
vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: { find: vi.fn() },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");

const USER_A = "507f1f77bcf86cd799439001";
const USER_B = "507f1f77bcf86cd799439002";
const REPO_1 = "607f1f77bcf86cd799439021";
const REPO_2 = "607f1f77bcf86cd799439022";
const REPO_3 = "607f1f77bcf86cd799439023";

function cookieFor(userId: string) {
  return `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: userId, githubId: "1" })}`;
}

function mockSessionUser(userId: string) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "octocat" });
}

const signals = [
  { signal: "dependency", weight: 0.2, applicable: true, strength: 1, meaningful: true, evidenceCount: 1, evidenceIds: ["e1"] },
  { signal: "documentation", weight: 0.05, applicable: false, strength: 0.5, meaningful: false, evidenceCount: 1, evidenceIds: ["e2"] },
];

const storedResult = {
  scoringVersion: "1.0.0",
  repositorySubstances: [],
  repositorySkillScores: [
    { repositoryId: REPO_1, skillId: "react", signals, applicableWeightSum: 0.2, baseScore: 80, meaningfulSignalCount: 1, breadthFactor: 0.5, score: 40 },
    { repositoryId: REPO_2, skillId: "react", signals, applicableWeightSum: 0.2, baseScore: 60, meaningfulSignalCount: 1, breadthFactor: 0.5, score: 30 },
    { repositoryId: REPO_3, skillId: "react", signals, applicableWeightSum: 0.2, baseScore: 20, meaningfulSignalCount: 1, breadthFactor: 0.5, score: 10 },
  ],
  skillScores: [
    {
      skillId: "react",
      score: 36.5,
      contributions: [
        { repositoryId: REPO_1, rank: 1, repositorySkillScore: 40, repositorySubstance: 0.9, rankMultiplier: 1, contributionWeight: 0.9 },
        { repositoryId: REPO_2, rank: 2, repositorySkillScore: 30, repositorySubstance: 0.5, rankMultiplier: 0.6, contributionWeight: 0.3 },
      ],
      excludedByRank: [{ repositoryId: REPO_3, repositorySkillScore: 10 }],
      contributionWeightSum: 1.2,
    },
  ],
};

function storedAnalysis(userId: string, result: unknown = storedResult) {
  return {
    _id: "analysis-1",
    userId,
    scoringVersion: "1.0.0",
    repositoryIds: [REPO_1, REPO_2, REPO_3],
    evidenceCount: 5,
    createdAt: new Date("2026-03-01T00:00:00Z"),
    result,
  };
}

// Simulates the analyses collection holding runs for two users.
function stubAnalyses(rows: Array<ReturnType<typeof storedAnalysis>>) {
  analysisFindOneMock.mockImplementation((filter: { userId: string }) => ({
    sort: () => ({ lean: async () => rows.find((row) => row.userId === filter.userId) ?? null }),
  }));
}

function stubRepositories() {
  repositoryFindMock.mockImplementation((filter: { userId: string; _id: { $in: string[] } }) => ({
    lean: async () =>
      filter.userId === USER_A
        ? filter._id.$in.map((id) => ({ _id: id, fullName: `octocat/repo-${id.slice(-1)}`, url: `https://github.com/octocat/repo-${id.slice(-1)}` }))
        : [],
  }));
}

describe("GET /api/skills", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    analysisFindOneMock.mockReset();
    repositoryFindMock.mockReset();
    stubRepositories();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/skills");

    expect(response.status).toBe(401);
    expect(analysisFindOneMock).not.toHaveBeenCalled();
  });

  it("groups the canonical taxonomy by category with persisted scores", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    const { categories, analysis } = response.body.data;
    expect(analysis).toMatchObject({ analysisId: "analysis-1", scoringVersion: "1.0.0", repositoryCount: 3, evidenceCount: 5 });
    expect(categories.map((category: { id: string }) => category.id)).toContain("frontend");

    const frontend = categories.find((category: { id: string }) => category.id === "frontend");
    const react = frontend.skills.find((skill: { id: string }) => skill.id === "react");
    expect(react).toMatchObject({ displayName: "React", categoryId: "frontend", score: 36.5, status: "scored", repositoryCount: 2 });

    const nextjs = frontend.skills.find((skill: { id: string }) => skill.id === "nextjs");
    expect(nextjs).toMatchObject({ score: null, status: "no-evidence", repositoryCount: 0 });
  });

  it("never lists a skill twice", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills").set("Cookie", cookieFor(USER_A));

    const ids = response.body.data.categories.flatMap((category: { skills: Array<{ id: string }> }) =>
      category.skills.map((skill) => skill.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports not-analyzed (not zero) when the user has no analysis", async () => {
    mockSessionUser(USER_B);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills").set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(200);
    expect(response.body.data.analysis).toBeNull();
    const skills = response.body.data.categories.flatMap((category: { skills: unknown[] }) => category.skills);
    expect(skills.every((skill: { score: unknown; status: string }) => skill.score === null && skill.status === "not-analyzed")).toBe(true);
  });

  it("scopes the analysis lookup to the session user", async () => {
    mockSessionUser(USER_B);
    stubAnalyses([storedAnalysis(USER_A)]);
    await request(app).get(`/api/skills?userId=${USER_A}`).set("Cookie", cookieFor(USER_B));

    expect(analysisFindOneMock).toHaveBeenCalledWith({ userId: USER_B });
  });

  it("returns a standard error for a malformed stored analysis", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A, { nonsense: true })]);
    const response = await request(app).get("/api/skills").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: { code: "INVALID_ANALYSIS", message: "The stored analysis is malformed." },
    });
  });
});

describe("GET /api/skills/:id", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    analysisFindOneMock.mockReset();
    repositoryFindMock.mockReset();
    stubRepositories();
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/api/skills/react");

    expect(response.status).toBe(401);
  });

  it("returns the stored score, contributions and signal breakdown unchanged", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills/react").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.skill).toEqual({ id: "react", displayName: "React", categoryId: "frontend", categoryName: "Frontend" });
    expect(data).toMatchObject({ status: "scored", score: 36.5, contributionWeightSum: 1.2 });

    expect(data.contributions).toHaveLength(2);
    expect(data.contributions[0]).toMatchObject({
      rank: 1,
      repositorySkillScore: 40,
      repositorySubstance: 0.9,
      rankMultiplier: 1,
      contributionWeight: 0.9,
      baseScore: 80,
      breadthFactor: 0.5,
      repository: { id: REPO_1, fullName: "octocat/repo-1", url: "https://github.com/octocat/repo-1" },
    });
    expect(data.contributions[0].signals).toEqual(signals);

    expect(data.excludedRepositories).toHaveLength(1);
    expect(data.excludedRepositories[0]).toMatchObject({ repositorySkillScore: 10, repository: { id: REPO_3 } });
    expect(data.contributions.map((entry: { repository: { id: string } }) => entry.repository.id)).not.toContain(REPO_3);
  });

  it("reports no-evidence for a skill the analysis did not score", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills/docker").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: "no-evidence", score: null, contributions: [], excludedRepositories: [] });
    expect(repositoryFindMock).not.toHaveBeenCalled();
  });

  it("reports not-analyzed when the user has no analysis", async () => {
    mockSessionUser(USER_B);
    stubAnalyses([storedAnalysis(USER_A)]);
    const response = await request(app).get("/api/skills/react").set("Cookie", cookieFor(USER_B));

    expect(response.body.data).toMatchObject({ status: "not-analyzed", score: null, analysis: null, contributions: [] });
  });

  it("looks repositories up by the session user only", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    await request(app).get("/api/skills/react").set("Cookie", cookieFor(USER_A));

    expect(repositoryFindMock).toHaveBeenCalledWith({ userId: USER_A, _id: { $in: [REPO_1, REPO_2, REPO_3] } });
  });

  it("does not fabricate repository identity that cannot be resolved", async () => {
    mockSessionUser(USER_A);
    stubAnalyses([storedAnalysis(USER_A)]);
    repositoryFindMock.mockReturnValue({ lean: async () => [] });
    const response = await request(app).get("/api/skills/react").set("Cookie", cookieFor(USER_A));

    expect(response.body.data.contributions[0].repository).toEqual({ id: REPO_1, fullName: null, url: null });
  });

  it("returns SKILL_NOT_FOUND for unknown skills", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/skills/cobol").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("SKILL_NOT_FOUND");
  });

  it("rejects an over-long skill identifier", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get(`/api/skills/${"a".repeat(65)}`).set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
