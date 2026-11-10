import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatChain, OUTAGE_COOLDOWN_MS, RATE_LIMIT_COOLDOWN_MS, UNUSABLE_COOLDOWN_MS, type ChatEndpoint } from "../src/llm/chat-chain.js";
import { LlmProviderError, type ChatRequest, type ChatResult, type LLMProvider } from "../src/llm/types.js";

const request: ChatRequest = { messages: [{ role: "user", content: "hi" }] };
const reply = (content: string): ChatResult => ({ content, toolCalls: [] });

function endpoint(key: string, behaviour: ChatResult | LlmProviderError | Error): { endpoint: ChatEndpoint; chat: ReturnType<typeof vi.fn> } {
  const chat = vi.fn(async () => {
    if (behaviour instanceof Error) throw behaviour;
    return behaviour;
  });
  const provider: LLMProvider = { explainGapAnalysis: vi.fn(), chat };
  return { endpoint: { key, provider }, chat };
}

let clock = 0;
const now = () => clock;

beforeEach(() => {
  clock = 1_000_000;
});

describe("chat fallback chain", () => {
  it("uses the first model when it works", async () => {
    const a = endpoint("a", reply("from a"));
    const b = endpoint("b", reply("from b"));
    const chat = createChatChain([a.endpoint, b.endpoint], { now });

    expect((await chat(request)).content).toBe("from a");
    expect(b.chat).not.toHaveBeenCalled();
  });

  it("moves to the next model on a rate limit and rests the limited one", async () => {
    const a = endpoint("a", new LlmProviderError("rate_limit", "limit"));
    const b = endpoint("b", reply("from b"));
    const chat = createChatChain([a.endpoint, b.endpoint], { now });

    expect((await chat(request)).content).toBe("from b");
    expect(a.chat).toHaveBeenCalledTimes(1);

    // While a is resting it is not even tried.
    expect((await chat(request)).content).toBe("from b");
    expect(a.chat).toHaveBeenCalledTimes(1);

    // After the rest it is tried again.
    clock += RATE_LIMIT_COOLDOWN_MS + 1;
    await chat(request);
    expect(a.chat).toHaveBeenCalledTimes(2);
  });

  it("falls through on outages, bad credentials and models that no longer exist", async () => {
    const down = endpoint("down", new LlmProviderError("server", "500"));
    const auth = endpoint("auth", new LlmProviderError("auth", "401"));
    const gone = endpoint("gone", new LlmProviderError("bad_request", "404", { upstreamCode: "model_not_found" }));
    const ok = endpoint("ok", reply("finally"));
    const cooldowns = new Map<string, number>();
    const chat = createChatChain([down.endpoint, auth.endpoint, gone.endpoint, ok.endpoint], { now, cooldowns });

    expect((await chat(request)).content).toBe("finally");
    expect(cooldowns.get("down")).toBe(clock + OUTAGE_COOLDOWN_MS);
    expect(cooldowns.get("auth")).toBe(clock + UNUSABLE_COOLDOWN_MS);
    expect(cooldowns.get("gone")).toBe(clock + UNUSABLE_COOLDOWN_MS);
  });

  it("does not hide a bad request or an unexpected error behind another model", async () => {
    const bad = endpoint("bad", new LlmProviderError("bad_request", "tool_use_failed", { upstreamCode: "tool_use_failed" }));
    const next = endpoint("next", reply("never"));
    await expect(createChatChain([bad.endpoint, next.endpoint], { now })(request)).rejects.toMatchObject({ kind: "bad_request" });
    expect(next.chat).not.toHaveBeenCalled();

    const crash = endpoint("crash", new TypeError("bug"));
    await expect(createChatChain([crash.endpoint, next.endpoint], { now })(request)).rejects.toBeInstanceOf(TypeError);
  });

  it("reports a plain rate limit when every model is limited, then when all are resting", async () => {
    const a = endpoint("a", new LlmProviderError("rate_limit", "limit"));
    const b = endpoint("b", new LlmProviderError("rate_limit", "limit"));
    const chat = createChatChain([a.endpoint, b.endpoint], { now });

    await expect(chat(request)).rejects.toMatchObject({ kind: "rate_limit" });
    await expect(chat(request)).rejects.toMatchObject({ kind: "rate_limit" });
    expect(a.chat).toHaveBeenCalledTimes(1);
    expect(b.chat).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last failure when the models failed for different reasons", async () => {
    const a = endpoint("a", new LlmProviderError("rate_limit", "limit"));
    const b = endpoint("b", new LlmProviderError("timeout", "slow"));
    await expect(createChatChain([a.endpoint, b.endpoint], { now })(request)).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("provider-specific tool call data", () => {
  it("sends Gemini's thought signature back unchanged with the tool result", async () => {
    const { createOpenAiCompatibleProvider } = await import("../src/llm/openai-compatible-provider.js");
    const signature = { google: { thought_signature: "abc123" } };
    const bodies: Array<{ messages: Array<Record<string, unknown>> }> = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "search_jobs", arguments: "{}" }, extra_content: signature }] } }] }),
        { status: 200 },
      );
    });
    const provider = createOpenAiCompatibleProvider({ baseUrl: "https://x.test/v1", model: "m", apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });

    const first = await provider.chat!({ messages: [{ role: "user", content: "jobs?" }] });
    expect(first.toolCalls[0]).toMatchObject({ id: "c1", name: "search_jobs", extra: signature });

    await provider.chat!({
      messages: [
        { role: "user", content: "jobs?" },
        { role: "assistant", content: null, toolCalls: first.toolCalls },
        { role: "tool", toolCallId: "c1", content: "{}" },
      ],
    });
    const assistant = bodies[1]!.messages[1] as { tool_calls: Array<Record<string, unknown>> };
    expect(assistant.tool_calls[0]).toMatchObject({ id: "c1", extra_content: signature });
  });
});

describe("chat chain configuration", () => {
  const envValues: Record<string, string | undefined> = {};

  async function providerFor(values: Record<string, string>) {
    vi.resetModules();
    for (const key of Object.keys(envValues)) delete envValues[key];
    Object.assign(envValues, values);
    vi.doMock("../src/config/env.js", () => ({ env: envValues }));
    return (await import("../src/llm/provider.js")).getLlmProvider()!;
  }

  function fakeFetch(failFor: (model: string) => number | null) {
    const calls: Array<{ url: string; model: string; key: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { model: string };
        const key = (init.headers as Record<string, string>).Authorization!.replace("Bearer ", "");
        calls.push({ url, model: body.model, key });
        const status = failFor(body.model);
        if (status) return new Response(JSON.stringify({ error: { code: status === 429 ? "rate_limit_exceeded" : "x" } }), { status });
        return new Response(JSON.stringify({ choices: [{ message: { content: `hello from ${body.model}` } }] }), { status: 200 });
      }),
    );
    return calls;
  }

  it("tries a second Groq model with the same key, then Gemini with its own key", async () => {
    const calls = fakeFetch((model) => (model.startsWith("openai/") ? 429 : null));
    const provider = await providerFor({ LLM_PROVIDER: "groq", LLM_API_KEY: "groq-key-123456", GEMINI_API_KEY: "gem-key-abcdef" });

    const result = await provider.chat!({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("hello from gemini-3.5-flash-lite");
    expect(calls.map((c) => [new URL(c.url).host, c.model, c.key])).toEqual([
      ["api.groq.com", "openai/gpt-oss-120b", "groq-key-123456"],
      ["api.groq.com", "openai/gpt-oss-20b", "groq-key-123456"],
      ["generativelanguage.googleapis.com", "gemini-3.5-flash-lite", "gem-key-abcdef"],
    ]);
  });

  it("works with just the extra Groq model when no Gemini key is set, and honours LLM_FALLBACK_MODELS", async () => {
    const calls = fakeFetch((model) => (model === "openai/gpt-oss-120b" ? 429 : null));
    const provider = await providerFor({ LLM_PROVIDER: "groq", LLM_API_KEY: "k1234567", LLM_FALLBACK_MODELS: " llama-3.3-70b-versatile , qwen/qwen3-32b " });

    const result = await provider.chat!({ messages: [{ role: "user", content: "hi" }] });

    expect(result.content).toBe("hello from llama-3.3-70b-versatile");
    expect(calls.map((c) => c.model)).toEqual(["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]);
  });
});
