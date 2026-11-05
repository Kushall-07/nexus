import { env } from "../config/env.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible-provider.js";
import type { LLMProvider } from "./types.js";

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
};

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

  return createOpenAiCompatibleProvider({ baseUrl, model, apiKey: env.LLM_API_KEY, label: name });
}
