import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findByIdMock = vi.fn();
const selectMock = vi.fn();
const findOneMock = vi.fn();

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
    selected: false,
    analyzed: false,
    analyzedAt: null,
    metadata: {
      visibility: "public",
      defaultBranch: "main",
      isFork: false,
      isArchived: false,
      primaryLanguage: "TypeScript",
      stars: 3,
      forks: 1,
      githubCreatedAt: new Date("2024-01-01T00:00:00Z"),
      githubUpdatedAt: new Date("2024-06-01T00:00:00Z"),
      githubPushedAt: new Date("2024-06-02T00:00:00Z"),
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

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("GET /api/github/repos/:id", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    selectMock.mockReset();
    findOneMock.mockReset();
    mockUserToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app).get(`/api/github/repos/${REPOSITORY_ID}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed repository id", async () => {
    const response = await request(app)
      .get("/api/github/repos/not-a-valid-id")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns REPOSITORY_NOT_FOUND when the repository does not exist", async () => {
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? null : null,
    );

    const response = await request(app)
      .get(`/api/github/repos/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
  });

  it("fetches and persists languages on first access", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubFetch(200, { TypeScript: 8000, JavaScript: 2000 });

    const response = await request(app)
      .get(`/api/github/repos/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.languages).toEqual({ TypeScript: 8000, JavaScript: 2000 });
    expect(response.body.data.languagePercentages).toEqual({ TypeScript: 80, JavaScript: 20 });
    expect(repoDoc.save).toHaveBeenCalledTimes(1);
  });

  it("does not call GitHub again once languages are cached", async () => {
    const repoDoc = makeRepoDoc({
      languages: new Map([["TypeScript", 8000]]),
    });
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get(`/api/github/repos/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repoDoc.save).not.toHaveBeenCalled();
  });

  it("maps a GitHub 404 during language retrieval to GITHUB_NOT_FOUND", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubFetch(404, { message: "Not Found" });

    const response = await request(app)
      .get(`/api/github/repos/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("GITHUB_NOT_FOUND");
  });

  it("never returns the GitHub token or encrypted token in the response", async () => {
    const repoDoc = makeRepoDoc();
    findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === OWNER_USER_ID ? repoDoc : null,
    );
    stubFetch(200, { TypeScript: 8000 });

    const response = await request(app)
      .get(`/api/github/repos/${REPOSITORY_ID}`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${ownerSessionToken}`);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(REAL_TOKEN);
    expect(serialized).not.toContain("encryptedGithubToken");
  });

  describe("ownership enforcement", () => {
    it("prevents one user from accessing another user's repository", async () => {
      // Repository A belongs to OWNER_USER_ID. The query filter always
      // includes the authenticated user's id, so a lookup scoped to a
      // different user must behave exactly as if the repository did not
      // exist — it must never return Repository A's data.
      const repoDoc = makeRepoDoc({ userId: OWNER_USER_ID });
      findOneMock.mockImplementation(async ({ userId }: { userId: string }) =>
        userId === OWNER_USER_ID ? repoDoc : null,
      );

      findByIdMock.mockReturnValue({ select: selectMock });
      selectMock.mockResolvedValue({
        _id: { toString: () => OTHER_USER_ID },
        githubId: "99",
        username: "intruder",
        encryptedGithubToken: encryptToken("gho_otherUserToken"),
      });

      const response = await request(app)
        .get(`/api/github/repos/${REPOSITORY_ID}`)
        .set("Cookie", `${SESSION_COOKIE_NAME}=${otherSessionToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain("octocat/demo");
    });
  });
});
