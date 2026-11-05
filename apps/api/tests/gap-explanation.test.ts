import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const analysisFindOneMock = vi.fn();
const providerMock = vi.fn();
const explainMock = vi.fn();

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
vi.mock("../src/llm/provider.js", () => ({ getLlmProvider: () => providerMock() }));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { LlmProviderError } = await import("../src/llm/types.js");
const { resetRateLimits } = await import("../src/middleware/rate-limit.js");

const USER_A = "507f1f77bcf86cd799439001";
const USER_B = "507f1f77bcf86cd799439002";
const ANALYSIS_ID = "707f1f77bcf86cd799439031";

const cookieFor = (userId: string) => `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: userId, githubId: "1" })}`;

function mockSessionUser(userId: string) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "octocat" });
}

function stubAnalysis(owner: string) {
  const skillScores = [
    { skillId: "python", score: 80, contributions: [], excludedByRank: [], contributionWeightSum: 1 },
    { skillId: "docker", score: 20, contributions: [], excludedByRank: [], contributionWeightSum: 1 },
  ];
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

const validExplanation = {
  summary: "Python evidence is solid; Docker evidence is thin.",
  strengths: ["Python"],
  priorityGaps: [{ skillId: "docker", explanation: "Little Docker evidence was found." }],
  recommendedActions: ["Containerize a project."],
  limitations: ["Only public GitHub signals are considered."],
};

async function createGap(userId = USER_A) {
  mockSessionUser(userId);
  stubAnalysis(userId);
  const response = await request(app).post("/api/gap-analysis").set("Cookie", cookieFor(userId)).send({ roleId: "software-engineer" });

  return response.body.data as { id: string };
}

const explain = (id: string, userId = USER_A, body: object = {}) =>
  request(app).post(`/api/gap-analysis/${id}/explanation`).set("Cookie", cookieFor(userId)).send(body);

beforeEach(() => {
  resetRateLimits();
  findByIdMock.mockReset();
  selectMock.mockReset();
  analysisFindOneMock.mockReset();
  providerMock.mockReset();
  explainMock.mockReset();
  providerMock.mockReturnValue({ explainGapAnalysis: explainMock });
  explainMock.mockResolvedValue(validExplanation);
  gapStore = [];
  nextId = 1;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/gap-analysis/:id/explanation", () => {
  it("requires authentication", async () => {
    const response = await request(app).post(`/api/gap-analysis/${ANALYSIS_ID}/explanation`);

    expect(response.status).toBe(401);
    expect(explainMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed id", async () => {
    mockSessionUser(USER_A);
    const response = await explain("nope");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for an unknown id and never exposes another user's analysis", async () => {
    const created = await createGap(USER_A);
    mockSessionUser(USER_B);
    const other = await explain(created.id, USER_B);
    const missing = await explain(ANALYSIS_ID, USER_B);

    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("GAP_ANALYSIS_NOT_FOUND");
    expect(missing.status).toBe(404);
    expect(explainMock).not.toHaveBeenCalled();
  });

  it("returns a validated explanation built only from stored deterministic data", async () => {
    const created = await createGap();
    const before = JSON.stringify(gapStore);
    // Fabricated client values must be ignored.
    const response = await explain(created.id, USER_A, { scores: { python: 100 }, roleMatch: 100 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      gapAnalysisId: created.id,
      roleId: "software-engineer",
      promptVersion: "1.0.0",
      explanation: validExplanation,
    });

    const sent = explainMock.mock.calls[0]![0];
    const python = sent.skills.find((skill: { skillId: string }) => skill.skillId === "python");
    const docker = sent.skills.find((skill: { skillId: string }) => skill.skillId === "docker");
    expect(sent).toMatchObject({ roleId: "software-engineer", scoringVersion: "1.0.0", roleCatalogVersion: "1.0.0" });
    expect(python).toMatchObject({ evidenceScore: 80, evidenceAvailable: true, criticalGap: false });
    expect(docker).toMatchObject({ evidenceScore: 20, criticalGap: true, deficit: 20 });
    // A skill with no stored score is described as missing evidence, scored 0.
    expect(sent.skills.find((skill: { skillId: string }) => skill.skillId === "typescript")).toMatchObject({
      evidenceScore: 0,
      evidenceAvailable: false,
    });
    expect(Object.keys(sent).sort()).toEqual(
      ["roleCatalogVersion", "roleId", "roleMatch", "roleName", "scoringVersion", "skills"],
    );
    expect(JSON.stringify(sent)).not.toContain(USER_A);
    // Stored deterministic data is untouched.
    expect(JSON.stringify(gapStore)).toBe(before);
  });

  it("reports a missing provider configuration without breaking the analysis", async () => {
    const created = await createGap();
    providerMock.mockReturnValue(null);
    const response = await explain(created.id);
    const analysis = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_A));

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("LLM_NOT_CONFIGURED");
    expect(analysis.status).toBe(200);
    expect(analysis.body.data.roleMatch).toBeGreaterThan(0);
  });

  it.each([
    ["auth", 503, "LLM_UNAVAILABLE"],
    ["timeout", 503, "LLM_UNAVAILABLE"],
    ["network", 503, "LLM_UNAVAILABLE"],
    ["server", 503, "LLM_UNAVAILABLE"],
    ["bad_request", 503, "LLM_UNAVAILABLE"],
    ["rate_limit", 429, "LLM_RATE_LIMITED"],
    ["invalid_response", 502, "LLM_INVALID_RESPONSE"],
  ] as const)("maps a %s provider failure to a safe %i error", async (kind, status, code) => {
    const created = await createGap();
    explainMock.mockRejectedValue(new LlmProviderError(kind, "upstream said: secret-key sk-123"));
    const response = await explain(created.id);

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(JSON.stringify(response.body)).not.toContain("sk-123");
  });

  it("logs provider, category and status for diagnosis without secrets or upstream text", async () => {
    const created = await createGap();
    explainMock.mockRejectedValue(
      new LlmProviderError("bad_request", "Authorization: Bearer sk-999", { provider: "groq", status: 400, upstreamCode: "model_decommissioned" }),
    );
    const response = await explain(created.id);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);

    expect(response.status).toBe(503);
    expect(logged).toContain("model_decommissioned");
    expect(logged).toContain("groq");
    expect(logged).toContain("400");
    expect(logged).not.toContain("sk-999");
    expect(JSON.stringify(response.body)).not.toContain("groq");
    expect(JSON.stringify(response.body)).not.toContain("model_decommissioned");
  });

  it("does not leak unexpected provider exceptions", async () => {
    const created = await createGap();
    explainMock.mockRejectedValue(new Error("boom with Authorization: Bearer abc"));
    const response = await explain(created.id);

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("Bearer");
  });

  it("rejects schema-invalid output and priority gaps for unknown skills", async () => {
    const created = await createGap();

    explainMock.mockResolvedValue({ ...validExplanation, summary: "" });
    expect((await explain(created.id)).body.error.code).toBe("LLM_INVALID_RESPONSE");

    explainMock.mockResolvedValue({ ...validExplanation, roleMatch: 100 });
    expect((await explain(created.id)).status).toBe(502);

    explainMock.mockResolvedValue({ ...validExplanation, priorityGaps: [{ skillId: "cobol", explanation: "x" }] });
    expect((await explain(created.id)).status).toBe(502);
  });

  it("leaves the deterministic result identical before and after an explanation", async () => {
    const created = await createGap();
    const before = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_A));
    await explain(created.id);
    explainMock.mockRejectedValue(new LlmProviderError("server", "x"));
    await explain(created.id);
    const after = await request(app).get(`/api/gap-analysis/${created.id}`).set("Cookie", cookieFor(USER_A));

    expect(after.body).toEqual(before.body);
    expect(gapStore).toHaveLength(1);
  });
});

describe("explanation request protection", () => {
  it("shares one provider call between concurrent requests for the same analysis", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A);
    let release!: () => void;
    explainMock.mockImplementation(() => new Promise((resolve) => (release = () => resolve(validExplanation))));

    const created = (await request(app).post("/api/gap-analysis").set("Cookie", cookieFor(USER_A)).send({ roleId: "ai-engineer" })).body.data;
    const first = explain(created.id).then((r) => r);
    const second = explain(created.id).then((r) => r);

    await vi.waitFor(() => expect(explainMock).toHaveBeenCalledTimes(1));
    release();

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(explainMock).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated explanation requests per user without touching other users", async () => {
    mockSessionUser(USER_A);
    stubAnalysis(USER_A);
    explainMock.mockResolvedValue(validExplanation);

    const created = (await request(app).post("/api/gap-analysis").set("Cookie", cookieFor(USER_A)).send({ roleId: "ai-engineer" })).body.data;
    const statuses: number[] = [];

    for (let i = 0; i < 7; i++) statuses.push((await explain(created.id)).status);

    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    expect(explainMock).toHaveBeenCalledTimes(5);
  });
});
