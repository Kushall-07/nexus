import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const bulkWriteMock = vi.fn();
const findMock = vi.fn();
const sortMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: {
    bulkWrite: (...args: unknown[]) => bulkWriteMock(...args),
    find: (...args: unknown[]) => findMock(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { encryptToken } = await import("../src/utils/token-encryption.js");

const REAL_TOKEN = "gho_realGithubAccessToken";
const SESSION_TOKEN = createSessionToken({ sub: "mongo-user-id", githubId: "42" });

function makeGithubRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: "demo",
    full_name: "octocat/demo",
    owner: { login: "octocat" },
    html_url: "https://github.com/octocat/demo",
    description: "A demo repo",
    private: false,
    fork: false,
    archived: false,
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 3,
    forks_count: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    pushed_at: "2024-06-02T00:00:00Z",
    ...overrides,
  };
}

function stubFetchPages(pages: unknown[][]) {
  let call = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const page = pages[call] ?? [];
      call += 1;
      return new Response(JSON.stringify(page), { status: 200 });
    }),
  );

  return () => call;
}

describe("GET /api/github/repos", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    bulkWriteMock.mockReset();
    findMock.mockReset();
    sortMock.mockReset();

    findByIdMock.mockReturnValue({ select: selectMock });
    selectMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
      encryptedGithubToken: encryptToken(REAL_TOKEN),
    });

    bulkWriteMock.mockResolvedValue({ ok: 1 });
    findMock.mockReturnValue({ sort: sortMock });
    sortMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get("/api/github/repos");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("discovers and persists public repositories for an authenticated user", async () => {
    stubFetchPages([[makeGithubRepo()]]);

    const response = await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(bulkWriteMock).toHaveBeenCalledTimes(1);

    const ops = bulkWriteMock.mock.calls[0][0] as Array<{
      updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert: boolean };
    }>;

    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter).toEqual({ userId: "mongo-user-id", githubId: 1 });
    expect(ops[0].updateOne.upsert).toBe(true);
  });

  it("excludes private repositories before persisting", async () => {
    stubFetchPages([[makeGithubRepo({ id: 1, private: false }), makeGithubRepo({ id: 2, private: true })]]);

    await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    const ops = bulkWriteMock.mock.calls[0][0] as Array<{
      updateOne: { filter: Record<string, unknown> };
    }>;

    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter.githubId).toBe(1);
  });

  it("never resets selected or analyzed state during discovery persistence", async () => {
    stubFetchPages([[makeGithubRepo()]]);

    await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    const ops = bulkWriteMock.mock.calls[0][0] as Array<{
      updateOne: { update: { $set: Record<string, unknown> } };
    }>;

    expect(ops[0].updateOne.update.$set).not.toHaveProperty("selected");
    expect(ops[0].updateOne.update.$set).not.toHaveProperty("analyzed");
    expect(ops[0].updateOne.update.$set).not.toHaveProperty("analyzedAt");
  });

  it("bounds pagination to a fixed number of GitHub requests", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      makeGithubRepo({ id: index + 1, full_name: `octocat/repo-${index + 1}` }),
    );

    const getCallCount = stubFetchPages([fullPage, fullPage, fullPage, fullPage]);

    const response = await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.data.truncated).toBe(true);
    expect(getCallCount()).toBe(3);
  });

  it("does not report truncation when fewer pages are returned than the bound", async () => {
    stubFetchPages([[makeGithubRepo()]]);

    const response = await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.body.data.truncated).toBe(false);
  });

  it("maps a GitHub failure during discovery to the correct error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })),
    );

    const response = await request(app)
      .get("/api/github/repos")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("GITHUB_TOKEN_EXPIRED");
    expect(bulkWriteMock).not.toHaveBeenCalled();
  });
});
