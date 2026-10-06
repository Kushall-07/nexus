import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const findOneMock = vi.fn();
const evidenceBulkWriteMock = vi.fn();
const evidenceDeleteManyMock = vi.fn();

vi.mock("../src/models/evidence.model.js", () => ({
  EvidenceModel: {
    bulkWrite: (...args: unknown[]) => evidenceBulkWriteMock(...args),
    deleteMany: (...args: unknown[]) => evidenceDeleteManyMock(...args),
  },
}));

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: {
    findOne: (...args: unknown[]) => findOneMock(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { encryptToken } = await import("../src/utils/token-encryption.js");

const REAL_TOKEN = "gho_realGithubAccessToken";
const OWNER_USER_ID = "owner-user-id";
const OTHER_USER_ID = "other-user-id";
const REPOSITORY_ID = "507f1f77bcf86cd799439011";

const ownerSessionToken = createSessionToken({ sub: OWNER_USER_ID, githubId: "42" });
const otherSessionToken = createSessionToken({ sub: OTHER_USER_ID, githubId: "99" });

function makeRepoDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => REPOSITORY_ID },
    userId: OWNER_USER_ID,
    owner: "octocat",
    name: "demo",
    fullName: "octocat/demo",
    url: "https://github.com/octocat/demo",
    description: "desc",
    languages: new Map(),
    selected: true,
    analyzed: false,
    analyzedAt: null,
    metadata: {
      visibility: "public",
      defaultBranch: "main",
      isFork: false,
      isArchived: false,
      primaryLanguage: "TypeScript",
      stars: 0,
      forks: 0,
      githubCreatedAt: null,
      githubUpdatedAt: null,
      githubPushedAt: null,
    },
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockUserToken() {
  findByIdMock.mockReturnValue({ select: selectMock });
  selectMock.mockResolvedValue({
    _id: { toString: () => OWNER_USER_ID },
    githubId: "42",
    username: "octocat",
    encryptedGithubToken: encryptToken(REAL_TOKEN),
  });
}

function stubGithubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = typeof input === "string" ? new URL(input) : input;

      if (url.pathname.endsWith("/git/trees/main")) {
        return new Response(JSON.stringify({ tree: [], truncated: false }), { status: 200 });
      }
      if (url.pathname.endsWith("/languages")) {
        return new Response(JSON.stringify({ TypeScript: 100 }), { status: 200 });
      }
      if (url.pathname.endsWith("/commits")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }),
  );
}

describe("POST /api/analysis/repositories/:id", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    findOneMock.mockReset();
    evidenceBulkWriteMock.mockReset().mockResolvedValue({});
    evidenceDeleteManyMock.mockReset().mockResolvedValue({});
    mockUserToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).post(`/api/analysis/repositories/${REPOSITORY_ID}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed repository id", async () => {
    const response = await request(app)
      .post("/api/analysis/repositories/not-a-valid-id")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns REPOSITORY_NOT_FOUND when the repository does not exist", async () => {
    findOneMock.mockResolvedValue(null);

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
  });

  it("rejects analysis of a repository that has not been selected", async () => {
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? makeRepoDoc({ selected: false }) : null,
    );

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_SELECTED");
  });

  it("prevents one user from analyzing another user's repository", async () => {
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? makeRepoDoc() : null,
    );

    findByIdMock.mockReturnValue({ select: selectMock });
    selectMock.mockResolvedValue({
      _id: { toString: () => OTHER_USER_ID },
      githubId: "99",
      username: "intruder",
      encryptedGithubToken: encryptToken("gho_otherUserToken"),
    });

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${otherSessionToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
  });

  it("analyzes a selected, owned repository and returns a normalized result", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubGithubFetch();

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.repository.fullName).toBe("octocat/demo");
    expect(response.body.data.analysis).toBeDefined();
    expect(response.body.data.analysis.requestBudget.limit).toBeGreaterThan(0);
    expect(repoDoc.save).toHaveBeenCalledTimes(1);
  });

  it("derives and persists Phase 4 evidence from the analysis", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubGithubFetch();

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.evidence.items).toEqual([
      expect.objectContaining({
        skillId: "typescript",
        evidenceType: "LANGUAGE",
        signal: "sourceUsage",
        normalizedStrength: 1,
      }),
    ]);
    expect(response.body.data.evidence.items[0]).not.toHaveProperty("userId");
    expect(evidenceBulkWriteMock).toHaveBeenCalledTimes(1);
    expect(evidenceDeleteManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER_USER_ID, repositoryId: REPOSITORY_ID }),
    );
  });

  it("does not persist evidence for a repository the user does not own", async () => {
    findOneMock.mockResolvedValue(null);

    await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(evidenceBulkWriteMock).not.toHaveBeenCalled();
    expect(evidenceDeleteManyMock).not.toHaveBeenCalled();
  });

  it("never returns the GitHub token or encrypted token in the response", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubGithubFetch();

    const response = await request(app)
      .post(`/api/analysis/repositories/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(REAL_TOKEN);
    expect(serialized).not.toContain("encryptedGithubToken");
  });
});
