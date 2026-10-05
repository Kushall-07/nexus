import { afterEach, describe, expect, it, vi } from "vitest";
import { githubRequest } from "../src/services/github-client.service.js";

const FAKE_TOKEN = "gho_super_secret_token_value";

function stubFetchOnce(init: {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(init.body !== undefined ? JSON.stringify(init.body) : "{}", {
        status: init.status,
        headers: init.headers,
      }),
    ),
  );
}

describe("githubRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("performs a successful authenticated request and returns normalized data", async () => {
    let capturedHeaders: Headers | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ login: "octocat" }), { status: 200 });
      }),
    );

    const { data } = await githubRequest<{ login: string }>(FAKE_TOKEN, "/user");

    expect(data).toEqual({ login: "octocat" });
    expect(capturedHeaders?.get("authorization")).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(capturedHeaders?.get("accept")).toBe("application/vnd.github+json");
    expect(capturedHeaders?.get("user-agent")).toBe("NEXUS-App");
  });

  it("maps a 401 response to GITHUB_TOKEN_EXPIRED", async () => {
    stubFetchOnce({ status: 401, body: { message: "Bad credentials" } });

    await expect(githubRequest(FAKE_TOKEN, "/user")).rejects.toMatchObject({
      code: "GITHUB_TOKEN_EXPIRED",
      status: 401,
    });
  });

  it("maps a rate-limited 403 response to GITHUB_RATE_LIMIT with reset info", async () => {
    stubFetchOnce({
      status: 403,
      body: { message: "API rate limit exceeded" },
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1700000000",
      },
    });

    await expect(githubRequest(FAKE_TOKEN, "/user/repos")).rejects.toMatchObject({
      code: "GITHUB_RATE_LIMIT",
      status: 429,
      extra: {
        remaining: 0,
        resetAt: new Date(1700000000 * 1000).toISOString(),
      },
    });
  });

  it("maps a non-rate-limited 403 response to GITHUB_TOKEN_EXPIRED", async () => {
    stubFetchOnce({ status: 403, body: { message: "Forbidden" } });

    await expect(githubRequest(FAKE_TOKEN, "/user/repos")).rejects.toMatchObject({
      code: "GITHUB_TOKEN_EXPIRED",
      status: 403,
    });
  });

  it("maps a 404 response to GITHUB_NOT_FOUND", async () => {
    stubFetchOnce({ status: 404, body: { message: "Not Found" } });

    await expect(githubRequest(FAKE_TOKEN, "/repos/owner/missing")).rejects.toMatchObject({
      code: "GITHUB_NOT_FOUND",
      status: 404,
    });
  });

  it("maps a 429 response to GITHUB_RATE_LIMIT", async () => {
    stubFetchOnce({ status: 429, body: { message: "Too Many Requests" } });

    await expect(githubRequest(FAKE_TOKEN, "/user/repos")).rejects.toMatchObject({
      code: "GITHUB_RATE_LIMIT",
      status: 429,
    });
  });

  it("maps a 5xx response to GITHUB_SERVICE_UNAVAILABLE", async () => {
    stubFetchOnce({ status: 503, body: { message: "Service Unavailable" } });

    await expect(githubRequest(FAKE_TOKEN, "/user")).rejects.toMatchObject({
      code: "GITHUB_SERVICE_UNAVAILABLE",
      status: 502,
    });
  });

  it("maps a network failure to GITHUB_SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(githubRequest(FAKE_TOKEN, "/user")).rejects.toMatchObject({
      code: "GITHUB_SERVICE_UNAVAILABLE",
      status: 502,
    });
  });

  it("maps a malformed JSON success response to GITHUB_SERVICE_UNAVAILABLE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );

    await expect(githubRequest(FAKE_TOKEN, "/user")).rejects.toMatchObject({
      code: "GITHUB_SERVICE_UNAVAILABLE",
      status: 502,
    });
  });

  it("never includes the access token in a thrown error", async () => {
    stubFetchOnce({ status: 401, body: { message: "Bad credentials" } });

    try {
      await githubRequest(FAKE_TOKEN, "/user");
      throw new Error("expected githubRequest to reject");
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(FAKE_TOKEN);
      expect((error as Error).message).not.toContain(FAKE_TOKEN);
    }
  });
});
