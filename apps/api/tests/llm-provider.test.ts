import { describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleProvider } from "../src/llm/openai-compatible-provider.js";
import { LlmProviderError, type GapExplanationRequest } from "../src/llm/types.js";

const request: GapExplanationRequest = {
  roleId: "ai-engineer",
  roleName: "AI Engineer",
  roleMatch: 40,
  roleCatalogVersion: "1.0.0",
  scoringVersion: "1.0.0",
  skills: [
    { skillId: "python", skillName: "Python", evidenceScore: 80, evidenceAvailable: true, minimumScore: 65, weight: 0.2, gap: 15, deficit: 0, criticalGap: false },
  ],
};

const valid = {
  summary: "Python evidence meets its minimum.",
  strengths: ["Python"],
  priorityGaps: [{ skillId: "python", explanation: "None." }],
  recommendedActions: ["Add tests."],
  limitations: ["GitHub-only evidence."],
};

const completion = (content: unknown) => ({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });
const json = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

function providerWith(fetchImpl: typeof fetch) {
  return createOpenAiCompatibleProvider({ baseUrl: "https://llm.test/v1/", apiKey: "secret-key", model: "m", fetchImpl });
}

async function kindOf(fetchImpl: typeof fetch) {
  const error = await providerWith(fetchImpl).explainGapAnalysis(request).catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(LlmProviderError);
  return (error as LlmProviderError).kind;
}

describe("OpenAI-compatible provider", () => {
  it("returns a validated explanation and sends bounded, low-variance request", async () => {
    const fetchMock = vi.fn(async () => json(completion(valid)));
    const result = await providerWith(fetchMock as unknown as typeof fetch).explainGapAnalysis(request);

    expect(result).toEqual(valid);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "m", temperature: 0.2, max_tokens: 1200 });
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("classifies provider failures", async () => {
    expect(await kindOf((async () => json({}, 401)) as unknown as typeof fetch)).toBe("auth");
    expect(await kindOf((async () => json({}, 429)) as unknown as typeof fetch)).toBe("rate_limit");
    expect(await kindOf((async () => json({}, 500)) as unknown as typeof fetch)).toBe("server");
    expect(await kindOf((async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch)).toBe("network");
    expect(await kindOf((async () => { throw new DOMException("t", "TimeoutError"); }) as unknown as typeof fetch)).toBe("timeout");
  });

  it("rejects invalid JSON, wrong shapes and oversized output", async () => {
    expect(await kindOf((async () => json("not json")) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json({ choices: [] })) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion("not json"))) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion({ ...valid, summary: undefined }))) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion({ ...valid, recommendedActions: [] }))) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion({ ...valid, roleMatch: 100 }))) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion({ ...valid, summary: "x".repeat(5000) }))) as unknown as typeof fetch)).toBe("invalid_response");
    expect(await kindOf((async () => json(completion("y".repeat(30_000)))) as unknown as typeof fetch)).toBe("invalid_response");
  });

  it("separates invalid model/request failures from server errors and keeps only a safe upstream code", async () => {
    const upstream = (status: number, body: unknown) => (async () => json(body, status)) as unknown as typeof fetch;
    const detailsOf = async (fetchImpl: typeof fetch) => {
      const error = (await createOpenAiCompatibleProvider({ baseUrl: "https://llm.test/v1", apiKey: "secret-key", model: "m", label: "groq", fetchImpl })
        .explainGapAnalysis(request)
        .catch((caught: unknown) => caught)) as LlmProviderError;

      return { kind: error.kind, details: error.details, message: error.message };
    };

    const retired = await detailsOf(upstream(400, { error: { code: "model_decommissioned", message: "secret-key leaked here" } }));
    expect(retired).toMatchObject({ kind: "bad_request", details: { provider: "groq", status: 400, upstreamCode: "model_decommissioned" } });

    const gemini = await detailsOf(upstream(404, [{ error: { code: 404, status: "NOT_FOUND", message: "x" } }]));
    expect(gemini).toMatchObject({ kind: "bad_request", details: { status: 404, upstreamCode: "404" } });

    const auth = await detailsOf(upstream(401, { error: { type: "invalid_api_key" } }));
    expect(auth).toMatchObject({ kind: "auth", details: { status: 401, upstreamCode: "invalid_api_key" } });

    const server = await detailsOf(upstream(503, "<html>down</html>"));
    expect(server).toMatchObject({ kind: "server", details: { status: 503 } });
    expect(server.details.upstreamCode).toBeUndefined();

    // Free-form upstream text is never carried through.
    const hostile = await detailsOf(upstream(400, { error: { code: "has spaces and secret-key" } }));
    expect(hostile.details.upstreamCode).toBeUndefined();
    for (const result of [retired, gemini, auth, server, hostile]) {
      expect(JSON.stringify(result)).not.toContain("secret-key");
    }
  });
});
