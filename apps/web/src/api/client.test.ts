import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiPost, validateApiBase } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// validateApiBase — validation and normalisation logic
// ---------------------------------------------------------------------------

describe("validateApiBase", () => {
  it("returns empty string for undefined (dev proxy mode)", () => {
    expect(validateApiBase(undefined)).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(validateApiBase("")).toBe("");
  });

  it("returns the origin of a valid https URL", () => {
    expect(validateApiBase("https://api.example.com")).toBe("https://api.example.com");
  });

  it("strips trailing slash and path segments, returning only the origin", () => {
    expect(validateApiBase("https://api.example.com/")).toBe("https://api.example.com");
    expect(validateApiBase("https://api.example.com/v1/")).toBe("https://api.example.com");
  });

  it("preserves non-standard ports", () => {
    expect(validateApiBase("https://api.example.com:8443")).toBe("https://api.example.com:8443");
  });

  it("accepts http for local development variants", () => {
    expect(validateApiBase("http://localhost:4000")).toBe("http://localhost:4000");
  });

  it("throws for a non-URL string, naming VITE_API_BASE_URL in the message", () => {
    expect(() => validateApiBase("not-a-url")).toThrow("VITE_API_BASE_URL");
    expect(() => validateApiBase("//missing-scheme.com")).toThrow("VITE_API_BASE_URL");
  });

  it("throws for a non-http/https protocol", () => {
    expect(() => validateApiBase("javascript:alert(1)")).toThrow("VITE_API_BASE_URL");
    expect(() => validateApiBase("data:text/html,<h1>hi</h1>")).toThrow("VITE_API_BASE_URL");
  });

  it("accepts an HTTPS URL in a production build", () => {
    expect(validateApiBase("https://api.example.com", true)).toBe("https://api.example.com");
  });

  it("throws for an HTTP URL in a production build", () => {
    expect(() => validateApiBase("http://api.example.com", true)).toThrow("HTTPS");
    expect(() => validateApiBase("http://localhost:4000", true)).toThrow("HTTPS");
  });

  it("accepts an HTTP URL when not in a production build (isProd=false or omitted)", () => {
    expect(validateApiBase("http://localhost:4000", false)).toBe("http://localhost:4000");
    expect(validateApiBase("http://localhost:4000")).toBe("http://localhost:4000");
  });
});

// ---------------------------------------------------------------------------
// API client fetch behaviour
// API_BASE is "" in the test environment (VITE_API_BASE_URL is not set),
// so fetch is called with just the path — matching the Vite dev proxy mode.
// ---------------------------------------------------------------------------

describe("API client fetch behaviour", () => {
  it("calls fetch with the path and credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { pong: true } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiGet<{ pong: boolean }>("/api/health");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    // API_BASE is "" in tests, so the URL is exactly the path with no double-slash
    expect(calledUrl).toBe("/api/health");
    expect(calledInit.credentials).toBe("include");
  });

  it("sets Content-Type application/json for POST requests with a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/gap-analysis", { roleId: "frontend-engineer" });

    const [, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((calledInit.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("throws ApiError with NETWORK_ERROR code when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed to fetch")));

    const error = await apiGet("/api/health").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
    expect((error as ApiError).status).toBe(0);
  });

  it("throws ApiError with the server error code on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } }),
          { status: 401 },
        ),
      ),
    );

    // /api/auth/ path — no unauthorizedListeners dispatch for auth routes
    const error = await apiGet("/api/auth/data").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe("UNAUTHORIZED");
  });

  it("throws ApiError with UNKNOWN_ERROR when the response envelope is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json at all", { status: 200 })),
    );

    const error = await apiGet("/api/skills").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("UNKNOWN_ERROR");
  });
});

// ---------------------------------------------------------------------------
// API client fetch behaviour — production origin
// Uses module isolation to exercise the actual request path when
// VITE_API_BASE_URL is set to a production HTTPS origin at module load time.
// ---------------------------------------------------------------------------

describe("API client fetch behaviour — production origin", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("prepends the configured API origin to the request path", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiGet: prodApiGet } = await import("./client");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await prodApiGet<{ ok: boolean }>("/api/health");

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://api.example.com/api/health");
    expect(calledInit.credentials).toBe("include");
  });

  it("does not introduce a duplicate /api prefix", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiGet: prodApiGet } = await import("./client");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await prodApiGet("/api/skills");

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.example.com/api/skills");
    expect(calledUrl).not.toMatch(/\/api\/api\//);
  });

  it("preserves query parameters", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiGet: prodApiGet } = await import("./client");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await prodApiGet("/api/opportunities?page=2&limit=10");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/api/opportunities?page=2&limit=10");
  });

  it("fires unauthorized listeners for non-auth 401 responses with a production origin", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    vi.resetModules();
    const { apiGet: prodApiGet, onUnauthorized } = await import("./client");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Session expired." } }),
          { status: 401 },
        ),
      ),
    );

    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    await prodApiGet("/api/skills").catch(() => undefined);

    expect(listener).toHaveBeenCalledOnce();
    cleanup();
  });
});
