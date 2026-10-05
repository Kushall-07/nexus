import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal in-memory simulation of the two collections involved in repository
// selection. The UserModel mock faithfully reproduces the atomic, single-op
// semantics that github-selection.service.ts relies on (no interleaving inside
// a single findOneAndUpdate call), which is what actually prevents the
// selection limit from being bypassed under concurrent requests.
interface FakeUser {
  _id: string;
  selectedRepositoryCount: number;
}

interface FakeRepository {
  _id: { toString: () => string };
  __id: string;
  userId: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  languages: Map<string, number>;
  selected: boolean;
  analyzed: boolean;
  analyzedAt: Date | null;
  metadata: Record<string, unknown>;
}

const MAX_SELECTION = 15;

let users: Map<string, FakeUser>;
let repositories: Map<string, FakeRepository>;

function makeUser(id: string, selectedRepositoryCount = 0): FakeUser {
  return { _id: id, selectedRepositoryCount };
}

function makeRepository(id: string, userId: string, selected = false): FakeRepository {
  return {
    _id: { toString: () => id },
    __id: id,
    userId,
    owner: "octocat",
    name: id,
    fullName: `octocat/${id}`,
    url: `https://github.com/octocat/${id}`,
    description: null,
    languages: new Map(),
    selected,
    analyzed: false,
    analyzedAt: null,
    metadata: { visibility: "public" },
  };
}

const userFindOneAndUpdateMock = vi.fn(async (filter: Record<string, any>) => {
  const user = users.get(filter._id);

  if (!user) {
    return null;
  }

  if (filter.$expr?.$lt) {
    const max = filter.$expr.$lt[1];

    if (user.selectedRepositoryCount < max) {
      user.selectedRepositoryCount += 1;
      return user;
    }

    return null;
  }

  if (filter.$expr?.$gt) {
    if (user.selectedRepositoryCount > 0) {
      user.selectedRepositoryCount -= 1;
      return user;
    }

    return null;
  }

  return null;
});

const repoFindOneMock = vi.fn(async (filter: Record<string, any>) => {
  const repo = repositories.get(filter._id);

  if (!repo || repo.userId !== filter.userId) {
    return null;
  }

  return repo;
});

const repoFindOneAndUpdateMock = vi.fn(
  async (filter: Record<string, any>, update: Record<string, any>) => {
    const repo = repositories.get(filter._id);

    if (!repo || repo.userId !== filter.userId) {
      return null;
    }

    if (filter.selected !== undefined && repo.selected !== filter.selected) {
      return null;
    }

    repo.selected = update.$set.selected;
    return repo;
  },
);

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findOneAndUpdate: (...args: unknown[]) =>
      (userFindOneAndUpdateMock as any)(...args),
  },
}));

vi.mock("../src/models/repository.model.js", () => ({
  RepositoryModel: {
    findOne: (...args: unknown[]) => (repoFindOneMock as any)(...args),
    findOneAndUpdate: (...args: unknown[]) =>
      (repoFindOneAndUpdateMock as any)(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { SESSION_COOKIE_NAME } = await import("../src/config/auth.config.js");
const { createSessionToken } = await import("../src/services/session.service.js");
const { setRepositorySelection } = await import(
  "../src/services/github-selection.service.js"
);

// The PATCH route validates that :id looks like a Mongo ObjectId, so HTTP-level
// tests need real-looking hex ids rather than arbitrary strings.
function objectId(n: number): string {
  return n.toString(16).padStart(24, "0");
}

const OWNER_USER_ID = "owner-user-id";
const OTHER_USER_ID = "other-user-id";
const ownerSessionToken = createSessionToken({ sub: OWNER_USER_ID, githubId: "42" });
const otherSessionToken = createSessionToken({ sub: OTHER_USER_ID, githubId: "99" });

function patchSelection(repoId: string, selected: unknown, token = ownerSessionToken) {
  return request(app)
    .patch(`/api/github/repos/${repoId}/selection`)
    .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`)
    .send({ selected });
}

describe("PATCH /api/github/repos/:id/selection", () => {
  beforeEach(() => {
    users = new Map();
    repositories = new Map();
    userFindOneAndUpdateMock.mockClear();
    repoFindOneMock.mockClear();
    repoFindOneAndUpdateMock.mockClear();

    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, 0));
  });

  it("rejects an unauthenticated request", async () => {
    const response = await request(app)
      .patch("/api/github/repos/507f1f77bcf86cd799439011/selection")
      .send({ selected: true });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed selection body", async () => {
    const repoId = objectId(1);
    repositories.set(repoId, makeRepository(repoId, OWNER_USER_ID));

    const response = await patchSelection(repoId, "true");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns REPOSITORY_NOT_FOUND for a repository that does not exist", async () => {
    const response = await patchSelection(objectId(9999), true);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
  });

  it("selects an unselected repository and persists the count", async () => {
    const repoId = objectId(1);
    repositories.set(repoId, makeRepository(repoId, OWNER_USER_ID));

    const response = await patchSelection(repoId, true);

    expect(response.status).toBe(200);
    expect(response.body.data.selected).toBe(true);
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(1);
  });

  it("deselects a selected repository and decrements the count", async () => {
    const repoId = objectId(1);
    repositories.set(repoId, makeRepository(repoId, OWNER_USER_ID, true));
    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, 1));

    const response = await patchSelection(repoId, false);

    expect(response.status).toBe(200);
    expect(response.body.data.selected).toBe(false);
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(0);
  });

  it("is idempotent when selecting an already-selected repository", async () => {
    const repoId = objectId(1);
    repositories.set(repoId, makeRepository(repoId, OWNER_USER_ID, true));
    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, 1));

    const response = await patchSelection(repoId, true);

    expect(response.status).toBe(200);
    expect(response.body.data.selected).toBe(true);
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(1);
  });

  it("allows selecting up to the configured maximum of 15 repositories", async () => {
    for (let i = 0; i < MAX_SELECTION; i += 1) {
      repositories.set(objectId(i), makeRepository(objectId(i), OWNER_USER_ID));
    }

    for (let i = 0; i < MAX_SELECTION; i += 1) {
      const response = await patchSelection(objectId(i), true);
      expect(response.status).toBe(200);
    }

    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(MAX_SELECTION);
  });

  it("rejects selecting a 16th repository with INVALID_REPOSITORY_SELECTION and does not truncate existing selections", async () => {
    for (let i = 0; i < MAX_SELECTION; i += 1) {
      repositories.set(objectId(i), makeRepository(objectId(i), OWNER_USER_ID, true));
    }
    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, MAX_SELECTION));

    const overflowId = objectId(MAX_SELECTION);
    repositories.set(overflowId, makeRepository(overflowId, OWNER_USER_ID));

    const response = await patchSelection(overflowId, true);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REPOSITORY_SELECTION");

    // No silent truncation: every previously selected repository is still selected.
    for (let i = 0; i < MAX_SELECTION; i += 1) {
      expect(repositories.get(objectId(i))?.selected).toBe(true);
    }
    expect(repositories.get(overflowId)?.selected).toBe(false);
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(MAX_SELECTION);
  });

  it("still allows deselecting while at the maximum", async () => {
    for (let i = 0; i < MAX_SELECTION; i += 1) {
      repositories.set(objectId(i), makeRepository(objectId(i), OWNER_USER_ID, true));
    }
    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, MAX_SELECTION));

    const response = await patchSelection(objectId(0), false);

    expect(response.status).toBe(200);
    expect(response.body.data.selected).toBe(false);
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(MAX_SELECTION - 1);
  });

  it("prevents a user from selecting another user's repository", async () => {
    const repoId = objectId(1);
    repositories.set(repoId, makeRepository(repoId, OWNER_USER_ID));
    users.set(OTHER_USER_ID, makeUser(OTHER_USER_ID, 0));

    const response = await patchSelection(repoId, true, otherSessionToken);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("REPOSITORY_NOT_FOUND");
    expect(repositories.get(repoId)?.selected).toBe(false);
  });

  it("enforces the boundary correctly when two selections race at the last available slot", async () => {
    for (let i = 0; i < MAX_SELECTION - 1; i += 1) {
      repositories.set(`repo-${i}`, makeRepository(`repo-${i}`, OWNER_USER_ID, true));
    }
    users.set(OWNER_USER_ID, makeUser(OWNER_USER_ID, MAX_SELECTION - 1));

    repositories.set("repo-race-a", makeRepository("repo-race-a", OWNER_USER_ID));
    repositories.set("repo-race-b", makeRepository("repo-race-b", OWNER_USER_ID));

    const [resultA, resultB] = await Promise.all([
      setRepositorySelection(OWNER_USER_ID, "repo-race-a", true),
      setRepositorySelection(OWNER_USER_ID, "repo-race-b", true).catch((error) => error),
    ]);

    const outcomes = [resultA, resultB];
    const succeeded = outcomes.filter(
      (outcome) => outcome && typeof outcome === "object" && "selected" in outcome,
    );
    const failed = outcomes.filter((outcome) => outcome instanceof Error);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as any).code).toBe("INVALID_REPOSITORY_SELECTION");
    expect(users.get(OWNER_USER_ID)?.selectedRepositoryCount).toBe(MAX_SELECTION);
  });
});
