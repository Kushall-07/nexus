import { beforeEach, describe, expect, it, vi } from "vitest";

// Configuration reaches the provider factory: blank values mean "off", presets
// supply defaults, and the factory never makes a network call.
const envValues: Record<string, string | undefined> = {};

vi.mock("../src/config/env.js", () => ({ env: envValues }));

const { getLlmProvider } = await import("../src/llm/provider.js");

beforeEach(() => {
  for (const key of Object.keys(envValues)) delete envValues[key];
  vi.stubGlobal("fetch", vi.fn());
});

describe("getLlmProvider", () => {
  it("is null when the provider or key is missing or the provider is unknown", () => {
    expect(getLlmProvider()).toBeNull();
    envValues.LLM_PROVIDER = "groq";
    expect(getLlmProvider()).toBeNull();
    envValues.LLM_API_KEY = "k";
    envValues.LLM_PROVIDER = "mystery";
    expect(getLlmProvider()).toBeNull();
    envValues.LLM_PROVIDER = "openai-compatible";
    expect(getLlmProvider()).toBeNull();
  });

  it("builds presets case-insensitively and targets the configured endpoint and model", async () => {
    envValues.LLM_API_KEY = "k";
    envValues.LLM_PROVIDER = "Gemini";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = getLlmProvider();
    expect(provider).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    await provider!.explainGapAnalysis({ roleId: "r", roleName: "R", roleMatch: 1, roleCatalogVersion: "1", scoringVersion: "1", skills: [] }).catch(() => undefined);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("gemini-2.5-flash");

    envValues.LLM_PROVIDER = "openai-compatible";
    envValues.LLM_BASE_URL = "https://x.test/v1";
    envValues.LLM_MODEL = "custom";
    expect(getLlmProvider()).not.toBeNull();
  });

  it("defaults Groq to a currently served model", async () => {
    envValues.LLM_API_KEY = "k";
    envValues.LLM_PROVIDER = "groq";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await getLlmProvider()!.explainGapAnalysis({ roleId: "r", roleName: "R", roleMatch: 1, roleCatalogVersion: "1", scoringVersion: "1", skills: [] }).catch(() => undefined);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("openai/gpt-oss-120b");
  });
});
