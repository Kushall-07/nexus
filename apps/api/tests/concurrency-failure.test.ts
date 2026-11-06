/**
 * Concurrency and failure-mode regression suite.
 *
 * These tests prove that individual components and API endpoints remain
 * correct under simultaneous requests and that every category of external
 * failure degrades gracefully to a well-structured error response without
 * leaking internals or corrupting stored state.
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJobService } from "../src/career/jobs/job-service.js";
import { ProviderError, type JobProvider } from "../src/career/jobs/provider.js";
import type { NormalizedJob } from "../src/career/types.js";

// ── Model mocks for HTTP tests ─────────────────────────────────────────────────

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const scoreMock = vi.fn();
const gapFindOneMock = vi.fn();
const explainMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: { findById: (...args: unknown[]) => findByIdMock(...args) },
}));

vi.mock("../src/services/scoring.service.js", () => ({
  scoreUserEvidence: (...args: unknown[]) => scoreMock(...args),
}));

vi.mock("../src/models/analysis.model.js", () => ({
  AnalysisModel: { findOne: vi.fn() },
}));
vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: { find: vi.fn().mockReturnValue({ lean: async () => [] }) },
}));
vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: { find: vi.fn() },
}));
vi.mock("../src/models/gap-analysis.model.js", () => ({
  GapAnalysisModel: {
    findOne: (...args: unknown[]) => gapFindOneMock(...args),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../src/llm/provider.js", () => ({
  getLlmProvider: () => ({ explainGapAnalysis: (...args: unknown[]) => explainMock(...args) }),
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { LlmProviderError } = await import("../src/llm/types.js");

const USER = "507f1f77bcf86cd799439001";
const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: USER, githubId: "1" })}`;
const GAP_ID = "607f1f77bcf86cd799439021";

function mockSession(userId = USER) {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({ _id: { toString: () => userId }, githubId: "1", username: "alice" });
}

function stubGapAnalysis(userId: string) {
  gapFindOneMock.mockReturnValue({
    lean: async () => ({
      _id: GAP_ID,
      userId,
      analysisId: "analysis-1",
      roleId: "ai-engineer",
      scoringVersion: "1.0.0",
      roleCatalogVersion: "1.0.0",
      roleCatalogHash: "a".repeat(64),
      createdAt: new Date("2026-03-01T00:00:00Z"),
      result: {
        roleId: "ai-engineer",
        roleName: "AI Engineer",
        roleMatch: 42,
        requirements: [],
        criticalGaps: [],
      },
    }),
  });
}

beforeEach(() => {
  findByIdMock.mockReset();
  selectMock.mockReset();
  scoreMock.mockReset();
  gapFindOneMock.mockReset();
  explainMock.mockReset();
});

// ── Concurrent scoring runs ────────────────────────────────────────────────────

describe("concurrent POST /api/analysis/run", () => {
  it("both concurrent requests call scoreUserEvidence with the session user and each returns independently", async () => {
    mockSession();
    // Each invocation resolves independently after a small artificial delay.
    let call = 0;
    scoreMock.mockImplementation(async () => {
      call++;
      await new Promise((resolve) => setTimeout(resolve, 1));
      return {
        analysisId: `analysis-${call}`,
        scoringVersion: "1.0.0",
        repositoryIds: ["r1"],
        skippedRepositoryIds: [],
        evidenceCount: 3,
        result: { skillScores: [{}] },
      };
    });

    const [resA, resB] = await Promise.all([
      request(app).post("/api/analysis/run").set("Cookie", cookie),
      request(app).post("/api/analysis/run").set("Cookie", cookie),
    ]);

    // Both must succeed.
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    // Both must have targeted the session user.
    expect(scoreMock).toHaveBeenCalledTimes(2);
    for (const [userId] of scoreMock.mock.calls) {
      expect(userId).toBe(USER);
    }
  });
});

// ── Analysis failure (data-safety regression) ─────────────────────────────────

describe("POST /api/analysis/run — scoring failure", () => {
  it("propagates the error cleanly when scoreUserEvidence rejects", async () => {
    mockSession();
    scoreMock.mockRejectedValue(new Error("MongoDB write concern failure"));

    const response = await request(app).post("/api/analysis/run").set("Cookie", cookie);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    // No internal detail must leak to the client.
    expect(JSON.stringify(response.body)).not.toContain("write concern");
    expect(JSON.stringify(response.body)).not.toContain("MongoDB");
  });
});

// ── LLM failure modes on gap explanation ──────────────────────────────────────

describe("POST /api/gap-analysis/:id/explanation — LLM failure modes", () => {
  it("returns 503 on LLM timeout without leaking the upstream details", async () => {
    mockSession();
    stubGapAnalysis(USER);
    explainMock.mockRejectedValue(new LlmProviderError("timeout", "LLM timed out."));

    const response = await request(app)
      .post(`/api/gap-analysis/${GAP_ID}/explanation`)
      .set("Cookie", cookie);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("LLM_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("LLM timed out");
  });

  it("returns 429 on LLM rate-limit", async () => {
    mockSession();
    stubGapAnalysis(USER);
    explainMock.mockRejectedValue(new LlmProviderError("rate_limit", "Rate limit reached."));

    const response = await request(app)
      .post(`/api/gap-analysis/${GAP_ID}/explanation`)
      .set("Cookie", cookie);

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("LLM_RATE_LIMITED");
  });

  it("returns 503 on LLM server error", async () => {
    mockSession();
    stubGapAnalysis(USER);
    explainMock.mockRejectedValue(new LlmProviderError("server", "Internal server error."));

    const response = await request(app)
      .post(`/api/gap-analysis/${GAP_ID}/explanation`)
      .set("Cookie", cookie);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("LLM_UNAVAILABLE");
  });

  it("returns 503 on LLM auth failure (no key configured)", async () => {
    mockSession();
    stubGapAnalysis(USER);
    explainMock.mockRejectedValue(new LlmProviderError("auth", "No API key configured."));

    const response = await request(app)
      .post(`/api/gap-analysis/${GAP_ID}/explanation`)
      .set("Cookie", cookie);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("LLM_UNAVAILABLE");
  });

  it("requires authentication", async () => {
    const response = await request(app).post(`/api/gap-analysis/${GAP_ID}/explanation`);
    expect(response.status).toBe(401);
  });
});

// ── Job service provider failures ─────────────────────────────────────────────

const BASE_JOB: NormalizedJob = {
  id: "remotive:job-1",
  provider: "remotive",
  providerJobId: "job-1",
  isDemo: false,
  title: "Engineer",
  company: "ACME",
  description: "Great role",
  url: "https://example.com/job/1",
  requiredSkills: [],
  preferredSkills: [],
  qualifications: [],
  sourceName: "Remotive",
  retrievedAt: new Date().toISOString(),
  stale: false,
};

function makeProvider(id: string, jobs: NormalizedJob[] | Error): JobProvider {
  return {
    id: id as never,
    label: id,
    status: () => ({ id: id as never, label: id, configured: true }),
    search: async () => {
      if (jobs instanceof Error) throw jobs;
      return jobs;
    },
  };
}

const SEARCH_QUERY = { keywords: "engineer", limit: 50, page: 1 };

describe("job service — provider failure isolation", () => {
  it("returns results from healthy providers even when one times out", async () => {
    const service = createJobService({
      liveProviders: [
        makeProvider("remotive", [BASE_JOB]),
        makeProvider("jsearch", new ProviderError("timeout", "Timed out.")),
      ],
      cacheTtlMs: 0,
    });

    const result = await service.search(SEARCH_QUERY, "live");

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]!.id).toBe("remotive:job-1");
    expect(result.providers).toHaveLength(2);

    const jsearch = result.providers.find((p) => p.id === "jsearch")!;
    expect(jsearch.ok).toBe(false);
    expect(jsearch.errorKind).toBe("timeout");

    const remotive = result.providers.find((p) => p.id === "remotive")!;
    expect(remotive.ok).toBe(true);
  });

  it("returns an empty job list when every provider fails, with per-provider diagnostics", async () => {
    const service = createJobService({
      liveProviders: [
        makeProvider("remotive", new ProviderError("rate_limited", "Rate limited.", 429)),
        makeProvider("jsearch", new ProviderError("auth", "Bad key.", 403)),
        makeProvider("himalayas", new ProviderError("bad_response", "Malformed JSON.")),
      ],
      cacheTtlMs: 0,
    });

    const result = await service.search(SEARCH_QUERY, "live");

    expect(result.jobs).toHaveLength(0);
    expect(result.providers).toHaveLength(3);
    expect(result.providers.every((p) => !p.ok)).toBe(true);
    expect(result.providers.map((p) => p.errorKind).sort()).toEqual(["auth", "bad_response", "rate_limited"].sort());
  });

  it("returns an empty job list (no crash) when a provider returns a bad_response", async () => {
    const service = createJobService({
      liveProviders: [
        makeProvider("remotive", new ProviderError("bad_response", "Malformed.")),
      ],
      cacheTtlMs: 0,
    });

    const result = await service.search(SEARCH_QUERY, "live");

    expect(result.jobs).toHaveLength(0);
    expect(result.providers[0]!.ok).toBe(false);
    expect(result.providers[0]!.errorKind).toBe("bad_response");
  });

  it("only uses the demo provider when source is 'demo', ignoring live provider state", async () => {
    const service = createJobService({
      liveProviders: [
        makeProvider("remotive", new ProviderError("network", "Down.")),
      ],
      cacheTtlMs: 0,
    });

    const result = await service.search(SEARCH_QUERY, "demo");

    expect(result.mode).toBe("demo");
  });
});

// ── Job service cache behaviour ────────────────────────────────────────────────

describe("job service — cache", () => {
  it("serves a cached result on the second call without touching the provider", async () => {
    let calls = 0;
    const countingProvider: JobProvider = {
      id: "remotive" as never,
      label: "remotive",
      status: () => ({ id: "remotive" as never, label: "remotive", configured: true }),
      search: async () => { calls++; return [BASE_JOB]; },
    };

    const service = createJobService({ liveProviders: [countingProvider], cacheTtlMs: 60_000 });

    await service.search(SEARCH_QUERY, "live");
    await service.search(SEARCH_QUERY, "live");

    expect(calls).toBe(1);
  });

  it("bypasses the cache for a different query", async () => {
    let calls = 0;
    const countingProvider: JobProvider = {
      id: "remotive" as never,
      label: "remotive",
      status: () => ({ id: "remotive" as never, label: "remotive", configured: true }),
      search: async () => { calls++; return []; },
    };

    const service = createJobService({ liveProviders: [countingProvider], cacheTtlMs: 60_000 });

    await service.search({ keywords: "engineer", limit: 50, page: 1 }, "live");
    await service.search({ keywords: "designer", limit: 50, page: 1 }, "live");

    expect(calls).toBe(2);
  });
});
