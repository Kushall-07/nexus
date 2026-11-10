import { env } from "../config/env.js";
import { createChatChain, type ChatEndpoint } from "./chat-chain.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible-provider.js";
import type { LLMProvider } from "./types.js";

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  // gemini-2.5-flash is closed to new API users, so the preset points at its successor.
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.5-flash" },
};

// The Gemini backup uses the lighter model: quicker to answer and friendlier free-tier limits.
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
// Gemini's free tier is sometimes slow to respond, so do not make the person wait long for it.
const GEMINI_TIMEOUT_MS = 25_000;

// Extra models on the same provider and key. Each model has its own free quota, so a second one
// keeps the Copilot answering when the first runs out for the minute or the day.
const DEFAULT_FALLBACK_MODELS: Record<string, string[]> = {
  groq: ["openai/gpt-oss-20b"],
};

// Chat models in the order they are tried: the configured model, its siblings on the same key, then Gemini
// if a Gemini key is configured. The chain lives for the whole process so its cooldowns persist.
let chainCache: { signature: string; chat: NonNullable<LLMProvider["chat"]> } | null = null;

function buildChatEndpoints(name: string, baseUrl: string, model: string): ChatEndpoint[] {
  const endpoints: ChatEndpoint[] = [];
  const seen = new Set<string>();
  const add = (label: string, url: string, key: string, modelName: string, timeoutMs?: number) => {
    const id = `${label}:${modelName}:${key.slice(-6)}`;
    if (seen.has(id)) return;
    seen.add(id);
    endpoints.push({ key: id, provider: createOpenAiCompatibleProvider({ baseUrl: url, model: modelName, apiKey: key, label, timeoutMs }) });
  };

  add(name, baseUrl, env.LLM_API_KEY!, model);

  const extras = env.LLM_FALLBACK_MODELS
    ? env.LLM_FALLBACK_MODELS.split(",").map((value) => value.trim()).filter(Boolean)
    : (DEFAULT_FALLBACK_MODELS[name] ?? []);
  for (const extra of extras) add(name, baseUrl, env.LLM_API_KEY!, extra);

  if (env.GEMINI_API_KEY) add("gemini", PRESETS.gemini!.baseUrl, env.GEMINI_API_KEY, env.GEMINI_MODEL ?? GEMINI_FALLBACK_MODEL, GEMINI_TIMEOUT_MS);

  return endpoints;
}

// Returns null when no usable provider is configured. Deliberately makes no
// network call: configuration problems surface only when an explanation is asked for.
export function getLlmProvider(): LLMProvider | null {
  const name = env.LLM_PROVIDER?.toLowerCase();

  if (!name || !env.LLM_API_KEY) return null;

  const preset = PRESETS[name];

  if (!preset && name !== "openai-compatible") return null;

  const baseUrl = env.LLM_BASE_URL ?? preset?.baseUrl;
  const model = env.LLM_MODEL ?? preset?.model;

  if (!baseUrl || !model) return null;

  const primary = createOpenAiCompatibleProvider({ baseUrl, model, apiKey: env.LLM_API_KEY, label: name });

  // Explanations and intent extraction use the configured model only; the Copilot chat gets the fallback chain.
  const signature = [name, baseUrl, model, env.LLM_API_KEY.slice(-6), env.LLM_FALLBACK_MODELS ?? "", env.GEMINI_API_KEY?.slice(-6) ?? "", env.GEMINI_MODEL ?? ""].join("|");
  if (chainCache?.signature !== signature) {
    chainCache = { signature, chat: createChatChain(buildChatEndpoints(name, baseUrl, model)) };
  }

  return { ...primary, chat: chainCache.chat };
}
