import { describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleProvider } from "../src/llm/openai-compatible-provider.js";
import { LlmProviderError, type GapExplanationRequest } from "../src/llm/types.js";

const request: GapExplanationRequest = {
  roleId: "ai-engineer",
  roleName: "AI Engineer",
  roleMatch: 40,
  roleCatalogVersion: "1.0.0",
  scoringVersion: "1.0.0",
  skills: [],
};

function streamOf(chunks: number, size: number, onCancel: () => void, status = 200): Response {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ >= chunks) return controller.close();
      controller.enqueue(new TextEncoder().encode("x".repeat(size)));
    },
    cancel: onCancel,
  });

  return new Response(body, { status });
}

const providerWith = (fetchImpl: typeof fetch) =>
  createOpenAiCompatibleProvider({ baseUrl: "https://llm.test/v1", apiKey: "secret-key", model: "m", fetchImpl });

describe("bounded provider response reads", () => {
  it("cancels an oversized success body instead of buffering all of it", async () => {
    const cancelled = vi.fn();
    const error = await providerWith((async () => streamOf(10_000, 10_000, cancelled)) as unknown as typeof fetch)
      .explainGapAnalysis(request)
      .catch((caught: unknown) => caught);

    expect((error as LlmProviderError).kind).toBe("invalid_response");
    expect(cancelled).toHaveBeenCalled();
  });

  it("classifies an oversized error body by status without reading it all", async () => {
    const cancelled = vi.fn();
    const error = await providerWith((async () => streamOf(10_000, 10_000, cancelled, 500)) as unknown as typeof fetch)
      .explainGapAnalysis(request)
      .catch((caught: unknown) => caught);

    expect((error as LlmProviderError).kind).toBe("server");
    expect(JSON.stringify((error as LlmProviderError).details)).not.toContain("secret-key");
    expect(cancelled).toHaveBeenCalled();
  });
});
