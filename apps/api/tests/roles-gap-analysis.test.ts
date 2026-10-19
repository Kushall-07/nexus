import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const analysisFindOneMock = vi.fn();

type GapRow = Record<string, unknown> & { _id: string; userId: string; createdAt: Date };
let gapStore: GapRow[] = [];
let nextId = 1;

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));
vi.mock("../src/models/analysis.model.js", () => ({
  AnalysisModel: { findOne: (...args: unknown[]) => analysisFindOneMock(...args) },
}));
vi.mock("../src/models/repository.model.js", () => ({ RepositoryModel: { find: vi.fn() } }));
vi.mock("../src/models/evidence.model.js", () => ({ EvidenceModel: { find: vi.fn() } }));
vi.mock("../src/models/gap-analysis.model.js", () => ({
  GapAnalysisModel: {
    create: async (doc: Record<string, unknown>) => {
      const row = {
        ...doc,
        _id: `607f1f77bcf86cd7994390${String(nextId++).padStart(2, "0")}`,
        createdAt: new Date("2026-03-02T00:00:00Z"),
      } as GapRow;
      gapStore.push(row);
      return row;
    },
    findOne: (filter: { _id: string; userId: string }) => ({
      lean: async () => gapStore.find((row) => row._id === filter._id && row.userId === filter.userId) ?? null,
    }),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { loadRoleCatalog, resetRoleCatalogCache } = await import("../src/roles/role-config.js");

const USER_A = "507f1f77bcf86cd799439001";
const USER_B = "507f1f77bcf86cd799439002";
const ANALYSIS_ID = "707f1f77bcf86cd799439031";

const cookieFor = (userId: string) => `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: userId, githubId: "1" })}`;

function mockSessionUser(userId: string) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "octocat" });
}

function skillScore(skillId: string, score: number) {
  return { skillId, score, contributions: [], excludedByRank: [], contributionWeightSum: 1 };
}

function stubAnalysis(owner: string, skillScores: unknown[]) {
  analysisFindOneMock.mockImplementation((filter: { userId: string }) => ({
    sort: () => ({
      lean: async () =>
        filter.userId === owner
          ? {
              _id: ANALYSIS_ID,
              userId: owner,
              scoringVersion: "1.0.0",
              repositoryIds: ["a"],
              evidenceCount: 3,
              createdAt: new Date("2026-03-01T00:00:00Z"),
              result: { scoringVersion: "1.0.0", repositorySubstances: [], repositorySkillScores: [], skillScores },
            }
          : null,
    }),
  }));
}

beforeEach(() => {
  findByIdMock.mockReset();
  selectMock.mockReset();
  analysisFindOneMock.mockReset();
  gapStore = [];
  nextId = 1;
});

describe("role catalog loader", () => {
  it("loads and validates config/roles.json once", () => {
    resetRoleCatalogCache();

    expect(loadRoleCatalog().roles).toHaveLength(5);
    expect(loadRoleCatalog()).toBe(loadRoleCatalog());
  });
});

describe("GET /api/roles", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/roles")).status).toBe(401);
  });

  it("returns exactly the five configured roles with canonical skill ids and names", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/roles").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    const { roles, catalogVersion } = response.body.data;
    expect(catalogVersion).toBe("1.0.0");
    expect(roles.map((role: { displayName: string }) => role.displayName)).toEqual([
      "Software Engineer", "Full-Stack Developer", "Backend Engineer", "AI Engineer", "ML Engineer",
    ]);
    expect(roles[0].requirements[2]).toEqual({
      skillId: "backend-development", skillName: "Backend", weight: 0.15, minimumScore: 50,
    });
  });
});

describe("GET /api/roles/:id", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/roles/ai-engineer")).status).toBe(401);
  });

  it("returns the validated role", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/roles/ml-engineer").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data.displayName).toBe("ML Engineer");
    expect(response.body.data.requirements).toHaveLength(7);
  });

  it("returns ROLE_NOT_FOUND for an unknown role", async () => {
    mockSessionUser(USER_A);
    const response = await request(app).get("/api/roles/data-scientist").set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROLE_NOT_FOUND");
  });
});

describe("POST /api/gap-analysis", () => {
  const post = (userId: string, body: unknown) =>
    request(app).post("/api/gap-analysis").set("Cookie", cookieFor(userId)).send(body as object);

  it("requires authentication", async () => {
    const response = await request(app).post("/api/gap-analysis").send({ roleId: "ai-engineer" });

    expect(response.status).toBe(401);
    expect(analysisFindOneMock).not.toHaveBeenCalled();
  });

  it("rejects a missing, invalid or over-specified body", async () => {
    mockSessionUser(USER_A);

    for (const body of [{}, { roleId: 5 }, { roleId: "" }, { roleId: "ai-engineer", weight: 1 }]) {
      const response = await post(USER_A, body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects an unknown role", async () => {
    mockSessionUser(USER_A);
    const response = await post(USER_A, { roleId: "janitor" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROLE_NOT_FOUND");
  });

  it("returns NO_ANALYSIS when the user has no scoring run", async () => {
    mockSessionUser(USER_B);
    stubAnalysis(USER_A, []);
    const response = await post(USER_B, { roleId: "ai-engineer" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NO_ANALYSIS");
    expect(gapStore).toHaveLength(0);
  });

  it("computes the role match, gaps, deficits and critical gaps from stored scores", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A, [skillScore("python", 80), skillScore("docker", 40), skillScore("rest-apis", 30)]);
    const response = await post(USER_A, { roleId: "ml-engineer" });

    expect(response.status).toBe(201);
    const data = response.body.data;
    expect(data).toMatchObject({ roleId: "ml-engineer", roleName: "ML Engineer", analysisId: ANALYSIS_ID, scoringVersion: "1.0.0" });
    // python 0.2*80 + docker 0.1*40 + rest-apis 0.1*30; everything else has no evidence (0).
    expect(data.roleMatch).toBeCloseTo(0.2 * 80 + 0.1 * 40 + 0.1 * 30, 9);

    const byId = Object.fromEntries(data.requirements.map((entry: { skillId: string }) => [entry.skillId, entry]));
    expect(byId.python).toMatchObject({ evidenceScore: 80, evidenceAvailable: true, minimumScore: 65, gap: 15, deficit: 0, criticalGap: false });
    expect(byId.docker).toMatchObject({ evidenceScore: 40, minimumScore: 40, gap: 0, deficit: 0, criticalGap: false });
    expect(byId["rest-apis"]).toMatchObject({ evidenceScore: 30, minimumScore: 40, gap: -10, deficit: 10, criticalGap: true });
    expect(byId.pytorch).toMatchObject({ evidenceScore: 0, evidenceAvailable: false, deficit: 60, criticalGap: true });

    expect(data.criticalGaps.map((entry: { skillId: string }) => entry.skillId)).toEqual(
      data.requirements.filter((entry: { criticalGap: boolean }) => entry.criticalGap).map((entry: { skillId: string }) => entry.skillId),
    );
    expect(data.criticalGaps.map((entry: { skillId: string }) => entry.skillId)).not.toContain("docker");
  });

  it("persists the result for the authenticated user with traceability metadata", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A, [skillScore("python", 80)]);
    const response = await post(USER_A, { roleId: "ai-engineer" });

    expect(gapStore).toHaveLength(1);
    expect(gapStore[0]).toMatchObject({
      userId: USER_A,
      analysisId: ANALYSIS_ID,
      roleId: "ai-engineer",
      scoringVersion: "1.0.0",
      roleCatalogVersion: "1.0.0",
    });
    expect(gapStore[0]!.roleCatalogHash).toMatch(/^[0-9a-f]{64}$/);
    expect(response.body.data.id).toBe(gapStore[0]!._id);
  });

  it("rejects client-supplied scores, weights and user ids", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A, [skillScore("python", 80)]);
    const response = await post(USER_A, { roleId: "ai-engineer", scores: { python: 100 }, userId: USER_B });

    expect(response.status).toBe(400);
    expect(gapStore).toHaveLength(0);
  });

  it("is deterministic for identical stored scores", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A, [skillScore("python", 71.3), skillScore("docker", 12)]);
    const first = await post(USER_A, { roleId: "software-engineer" });
    const second = await post(USER_A, { roleId: "software-engineer" });

    const strip = ({ id: _id, ...rest }: Record<string, unknown>) => rest;
    expect(strip(second.body.data)).toEqual(strip(first.body.data));
  });

  it("does not hide critical gaps behind a high overall match", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A, [
      skillScore("python", 100), skillScore("typescript", 100), skillScore("backend-development", 100),
      skillScore("database-systems", 100), skillScore("rest-apis", 100), skillScore("software-testing", 100),
      skillScore("docker", 39.9),
    ]);
    const response = await post(USER_A, { roleId: "software-engineer" });

    expect(response.body.data.roleMatch).toBeGreaterThan(90);
    expect(response.body.data.criticalGaps.map((entry: { skillId: string }) => entry.skillId)).toEqual(["docker"]);
  });
});

describe("GET /api/gap-analysis/:id", () => {
  async function createAs(userId: string) {
    mockSessionUser(userId);
    stubAnalysis(userId, [skillScore("python", 80)]);
    const response = await request(app).post("/api/gap-analysis").set("Cookie", cookieFor(userId)).send({ roleId: "ai-engineer" });

    return response.body.data as { id: string };
  }

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/gap-analysis/${ANALYSIS_ID}`)).status).toBe(401);
  });

  it("returns the user's own persisted result", async () => {
    const created = await createAs(USER_A);
    const response = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ ...created, ...response.body.data });
    expect(response.body.data.roleId).toBe("ai-engineer");
    expect(response.body.data.requirements.length).toBeGreaterThan(0);
  });

  it("does not expose another user's result", async () => {
    const created = await createAs(USER_A);
    mockSessionUser(USER_B);
    const response = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_B));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("GAP_ANALYSIS_NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("roleMatch");
  });

  it("returns not found for an unknown id and 400 for a malformed id", async () => {
    mockSessionUser(USER_A);
    const missing = await request(app).get(`/api/gap-analysis/${ANALYSIS_ID}`).set("Cookie", cookieFor(USER_A));
    const malformed = await request(app).get("/api/gap-analysis/not-an-id").set("Cookie", cookieFor(USER_A));

    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("never leaks the owning user id or internal fields", async () => {
    const created = await createAs(USER_A);
    const response = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_A));

    expect(JSON.stringify(response.body)).not.toContain(USER_A);
    expect(response.body.data).not.toHaveProperty("userId");
    expect(response.body.data).not.toHaveProperty("roleCatalogHash");
  });
});
