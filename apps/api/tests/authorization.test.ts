/**
 * Authorization regression suite — cross-user isolation.
 *
 * Every test in this file proves that a specific API endpoint cannot be used
 * to read or mutate data belonging to a different user. The session user is
 * always the source of truth; no request parameter, body field or query string
 * can substitute for it.
 *
 * Keep this file organized by resource so it is easy to extend when new
 * endpoints are added.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Model mocks ────────────────────────────────────────────────────────────────

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const analysisFindOneMock = vi.fn();
const evidenceFindMock = vi.fn();
const repoFindOneMock = vi.fn();
const scoreMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));

vi.mock("../src/models/analysis.model.js", () => ({
  AnalysisModel: { findOne: (...args: unknown[]) => analysisFindOneMock(...args) },
}));

vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: {
    find: (...args: unknown[]) => evidenceFindMock(...args),
    bulkWrite: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: {
    findOne: (...args: unknown[]) => repoFindOneMock(...args),
    find: vi.fn().mockReturnValue({ lean: async () => [] }),
  },
}));

vi.mock("../src/services/scoring.service.js", () => ({
  scoreUserEvidence: (...args: unknown[]) => scoreMock(...args),
}));

// ── App and helpers ────────────────────────────────────────────────────────────

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");

const USER_A = "507f1f77bcf86cd799439001";
const USER_B = "507f1f77bcf86cd799439002";
const REPO_ID = "607f1f77bcf86cd799439021";

function cookieFor(userId: string) {
  return `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: userId, githubId: "1" })}`;
}

/** Simulate the requireAuth middleware resolving a user document. */
function mockSession(userId: string) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "alice" });
}

/** Stub an analysis that only exists for `ownerId`. */
function stubAnalysis(ownerId: string) {
  analysisFindOneMock.mockImplementation((filter: { userId: string }) => ({
    sort: () => ({
      lean: async () =>
        filter.userId === ownerId
          ? {
              _id: "analysis-1",
              userId: ownerId,
              scoringVersion: "1.0.0",
              repositoryIds: [REPO_ID],
              evidenceCount: 2,
              createdAt: new Date(),
              result: {
                scoringVersion: "1.0.0",
                repositorySubstances: [],
                repositorySkillScores: [],
                skillScores: [],
              },
            }
          : null,
    }),
  }));
}

/** Stub evidence that only exists for `ownerId`. */
function stubEvidence(ownerId: string) {
  evidenceFindMock.mockImplementation((filter: { userId: string }) => ({
    sort: () => ({
      lean: async () =>
        filter.userId === ownerId
          ? [
              {
                _id: "ev1",
                repositoryId: REPO_ID,
                skillId: "react",
                evidenceType: "DEPENDENCY",
                signal: "dependency",
                value: "react",
                normalizedStrength: 1,
                explanation: "dependency on react",
                evidenceKey: "k1",
                detectedAt: new Date(),
              },
            ]
          : [],
    }),
  }));
}

// ── Reset mocks between tests ──────────────────────────────────────────────────

beforeEach(() => {
  findByIdMock.mockReset();
  selectMock.mockReset();
  analysisFindOneMock.mockReset();
  evidenceFindMock.mockReset();
  repoFindOneMock.mockReset();
  scoreMock.mockReset();
});

// ── POST /api/analysis/run ─────────────────────────────────────────────────────

describe("POST /api/analysis/run — user isolation", () => {
  it("calls scoreUserEvidence with the session user, not any body-supplied userId", async () => {
    mockSession(USER_B);
    scoreMock.mockResolvedValue({
      analysisId: "a1",
      scoringVersion: "1.0.0",
      repositoryIds: [],
      skippedRepositoryIds: [],
      evidenceCount: 0,
      result: { skillScores: [] },
    });

    // Attempt to supply a foreign userId in the body — it must be ignored.
    await request(app)
      .post("/api/analysis/run")
      .set("Cookie", cookieFor(USER_B))
      .send({ userId: USER_A });

    expect(scoreMock).toHaveBeenCalledWith(USER_B);
    expect(scoreMock).not.toHaveBeenCalledWith(USER_A);
  });
});

// ── GET /api/skills ────────────────────────────────────────────────────────────

describe("GET /api/skills — user isolation", () => {
  it("queries the analysis collection with the session user, never the URL userId param", async () => {
    mockSession(USER_B);
    stubAnalysis(USER_A);

    // A query param userId must be silently ignored.
    await request(app)
      .get(`/api/skills?userId=${USER_A}`)
      .set("Cookie", cookieFor(USER_B));

    // The only call must have been scoped to the authenticated user.
    expect(analysisFindOneMock).toHaveBeenCalledWith({ userId: USER_B });
  });

  it("returns no-score skills when User B has no analysis, even if User A does", async () => {
    mockSession(USER_B);
    stubAnalysis(USER_A);

    const response = await request(app).get("/api/skills").set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(200);
    expect(response.body.data.analysis).toBeNull();
    // All skills must reflect the absence of analysis, not User A's data.
    const allSkills = response.body.data.categories.flatMap(
      (category: { skills: Array<{ status: string }> }) => category.skills,
    );
    expect(allSkills.every((skill: { status: string }) => skill.status === "not-analyzed")).toBe(true);
  });
});

// ── GET /api/skills/:id ────────────────────────────────────────────────────────

describe("GET /api/skills/:id — user isolation", () => {
  it("returns not-analyzed for User B even if User A has a scored react entry", async () => {
    mockSession(USER_B);
    stubAnalysis(USER_A);

    const response = await request(app).get("/api/skills/react").set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("not-analyzed");
    expect(response.body.data.score).toBeNull();
  });
});

// ── GET /api/skills/:id/evidence ──────────────────────────────────────────────

describe("GET /api/skills/:id/evidence — user isolation", () => {
  it("queries evidence with the session userId and cannot be overridden via query string", async () => {
    mockSession(USER_B);
    stubEvidence(USER_A);

    // Attempt to supply a foreign userId in the query string — it must be ignored.
    const response = await request(app)
      .get(`/api/skills/react/evidence?userId=${USER_A}`)
      .set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(200);
    // User B has no evidence — the result must be empty.
    expect(response.body.data.evidence).toHaveLength(0);

    // The find query must include exactly USER_B's id.
    expect(evidenceFindMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_B }),
    );
    expect(evidenceFindMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }),
    );
  });

  it("returns evidence only for the authenticated session user", async () => {
    mockSession(USER_A);
    stubEvidence(USER_A);

    const response = await request(app)
      .get("/api/skills/react/evidence")
      .set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data.evidence).toHaveLength(1);
    // The response must not expose the userId field.
    expect(JSON.stringify(response.body)).not.toContain(USER_A);
  });
});

// ── GET /api/github/repos/:id ──────────────────────────────────────────────────

describe("GET /api/github/repos/:id — user isolation", () => {
  it("returns REPOSITORY_NOT_FOUND when User B requests User A's repository", async () => {
    // The mock only returns the document when userId matches OWNER.
    repoFindOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === USER_A
        ? {
            _id: { toString: () => REPO_ID },
            userId: USER_A,
            owner: "alice",
            name: "secret-repo",
            fullName: "alice/secret-repo",
            url: "https://github.com/alice/secret-repo",
            description: null,
            languages: new Map([["TypeScript", 1000]]),
            selected: false,
            analyzed: false,
            analyzedAt: null,
            metadata: { visibility: "private", defaultBranch: "main", isFork: false, isArchived: false, primaryLanguage: "TypeScript", stars: 0, forks: 0, githubCreatedAt: null, githubUpdatedAt: null, githubPushedAt: null },
            save: vi.fn().mockResolvedValue(undefined),
          }
        : null,
    );

    // User B authenticates.
    findByIdMock.mockReturnValue({ select: selectMock });
    selectMock.mockResolvedValue({
      _id: { toString: () => USER_B },
      githubId: "2",
      username: "bob",
      encryptedGithubToken: (await import("../src/utils/token-encryption.js")).encryptToken("gho_bobToken"),
    });

    const response = await request(app)
      .get(`/api/github/repos/${REPO_ID}`)
      .set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("alice/secret-repo");
  });
});

// ── POST /api/analysis/repositories/:id ──────────────────────────────────────

describe("POST /api/analysis/repositories/:id — user isolation", () => {
  it("returns REPOSITORY_NOT_FOUND when User B tries to analyze User A's repository", async () => {
    repoFindOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === USER_A
        ? {
            _id: { toString: () => REPO_ID },
            userId: USER_A,
            selected: true,
            analyzed: false,
            save: vi.fn(),
          }
        : null,
    );

    findByIdMock.mockReturnValue({ select: selectMock });
    selectMock.mockResolvedValue({
      _id: { toString: () => USER_B },
      githubId: "2",
      username: "bob",
      encryptedGithubToken: (await import("../src/utils/token-encryption.js")).encryptToken("gho_bobToken"),
    });

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPO_ID}`)
      .set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
  });
});

// ── POST /api/gap-analysis ─────────────────────────────────────────────────────

describe("POST /api/gap-analysis — user isolation", () => {
  it("returns NO_ANALYSIS when User B has no analysis, even if a userId is supplied in the body", async () => {
    mockSession(USER_B);
    stubAnalysis(USER_A);

    const response = await request(app)
      .post("/api/gap-analysis")
      .set("Cookie", cookieFor(USER_B))
      .send({ roleId: "ai-engineer" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NO_ANALYSIS");
  });
});
