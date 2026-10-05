import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdateMock = vi.fn();
const findByIdMock = vi.fn();

vi.mock("../src/models/user.model.js", () => ({
  UserModel: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

const { default: app } = await import("../src/app.js");
const { OAUTH_STATE_COOKIE_NAME } = await import("../src/config/auth.config.js");

const VALID_STATE = "valid-state-value-123";

function stubFetch(responses: {
  token?: { ok: boolean; body: unknown };
  identity?: { ok: boolean; body: unknown };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const target = url.toString();

      if (target.includes("github.com/login/oauth/access_token")) {
        const tokenResponse = responses.token ?? { ok: true, body: { access_token: "gho_fakeToken" } };
        return new Response(JSON.stringify(tokenResponse.body), {
          status: tokenResponse.ok ? 200 : 400,
        });
      }

      if (target.includes("api.github.com/user")) {
        const identityResponse = responses.identity ?? {
          ok: true,
          body: { id: 42, login: "octocat" },
        };
        return new Response(JSON.stringify(identityResponse.body), {
          status: identityResponse.ok ? 200 : 401,
        });
      }

      throw new Error(`Unexpected fetch to ${target}`);
    }),
  );
}

describe("GET /api/auth/github/callback", () => {
  beforeEach(() => {
    findOneAndUpdateMock.mockReset();
    findByIdMock.mockReset();
    findOneAndUpdateMock.mockResolvedValue({
      _id: { toString: () => "mongo-user-id" },
      githubId: "42",
      username: "octocat",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a callback missing the authorization code", async () => {
    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("rejects a callback missing the state parameter", async () => {
    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123" })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("rejects a callback whose state does not match the stored cookie", async () => {
    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: "mismatched-state" })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_AUTH");
  });

  it("clears the OAuth state cookie on callback", async () => {
    stubFetch({});

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    const setCookieHeader = response.headers["set-cookie"] as unknown as string[];
    const clearedStateCookie = setCookieHeader.find((cookie) =>
      cookie.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`),
    );

    expect(clearedStateCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("handles GitHub token exchange failure", async () => {
    stubFetch({ token: { ok: false, body: { error: "bad_verification_code" } } });

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("handles a malformed GitHub token response", async () => {
    stubFetch({ token: { ok: true, body: { token_type: "bearer" } } });

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("handles a GitHub identity API failure", async () => {
    stubFetch({ identity: { ok: false, body: { message: "Bad credentials" } } });

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("handles a GitHub identity response missing the numeric id", async () => {
    stubFetch({ identity: { ok: true, body: { login: "octocat" } } });

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("handles a GitHub identity response missing the login", async () => {
    stubFetch({ identity: { ok: true, body: { id: 42 } } });

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe("GITHUB_AUTH_FAILED");
  });

  it("completes a successful login: persists the user, encrypts the token, and redirects without leaking it", async () => {
    stubFetch({});

    const response = await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(response.status).toBe(302);
    expect(findOneAndUpdateMock).toHaveBeenCalledTimes(1);

    const [filter, update, options] = findOneAndUpdateMock.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    expect(filter).toEqual({ githubId: "42" });
    expect(update.username).toBe("octocat");
    expect(update.encryptedGithubToken).toBeTypeOf("string");
    expect(update.encryptedGithubToken).not.toBe("gho_fakeToken");
    expect(options).toMatchObject({ upsert: true, new: true });

    const bodyAndHeaders = JSON.stringify(response.body) + JSON.stringify(response.headers);
    expect(bodyAndHeaders).not.toContain("gho_fakeToken");

    const setCookieHeader = response.headers["set-cookie"] as unknown as string[];
    expect(setCookieHeader.some((cookie) => cookie.startsWith("nexus_session="))).toBe(true);
    expect(setCookieHeader.some((cookie) => cookie.includes("gho_fakeToken"))).toBe(false);
  });

  it("updates an existing user rather than creating a duplicate", async () => {
    stubFetch({});

    await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    await request(app)
      .get("/api/auth/github/callback")
      .query({ code: "abc123", state: VALID_STATE })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${VALID_STATE}`);

    expect(findOneAndUpdateMock).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdateMock.mock.calls[0][0]).toEqual({ githubId: "42" });
    expect(findOneAndUpdateMock.mock.calls[1][0]).toEqual({ githubId: "42" });
  });
});
