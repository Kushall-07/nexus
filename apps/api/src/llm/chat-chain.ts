import { LlmProviderError, type ChatRequest, type ChatResult, type LLMProvider } from "./types.js";

// Several chat models behind one `chat` call. Free tiers have small quotas, so when one model is
// rate limited (or down) the next one answers instead, and a model that just failed is left alone
// for a while rather than being hit again on every message.

export interface ChatEndpoint {
  // Unique, e.g. "groq:openai/gpt-oss-120b".
  key: string;
  provider: LLMProvider;
}

export const RATE_LIMIT_COOLDOWN_MS = 60_000;
export const OUTAGE_COOLDOWN_MS = 15_000;
export const UNUSABLE_COOLDOWN_MS = 10 * 60_000;

type Cooldowns = Map<string, number>;

// Failures that mean "try the next model", with how long to rest the one that failed.
function cooldownFor(error: LlmProviderError): number | null {
  switch (error.kind) {
    case "rate_limit":
      return RATE_LIMIT_COOLDOWN_MS;
    case "timeout":
    case "network":
    case "server":
      return OUTAGE_COOLDOWN_MS;
    case "auth":
      return UNUSABLE_COOLDOWN_MS;
    case "bad_request":
      // A model that no longer exists is skipped; any other bad request is a problem with the request itself.
      return /model/i.test(error.details.upstreamCode ?? "") ? UNUSABLE_COOLDOWN_MS : null;
    default:
      return null;
  }
}

export function createChatChain(
  endpoints: ChatEndpoint[],
  options: { now?: () => number; cooldowns?: Cooldowns } = {},
): (request: ChatRequest) => Promise<ChatResult> {
  const now = options.now ?? Date.now;
  const cooldowns = options.cooldowns ?? new Map<string, number>();

  return async (request) => {
    const ready = endpoints.filter((endpoint) => (cooldowns.get(endpoint.key) ?? 0) <= now());
    if (ready.length === 0) throw new LlmProviderError("rate_limit", "Every chat model is resting after a rate limit or failure.");

    let lastError: unknown;
    let allRateLimited = true;

    for (const endpoint of ready) {
      try {
        return await endpoint.provider.chat!(request);
      } catch (error) {
        if (!(error instanceof LlmProviderError)) throw error;
        const rest = cooldownFor(error);
        if (rest === null) throw error;
        cooldowns.set(endpoint.key, now() + rest);
        if (error.kind !== "rate_limit") allRateLimited = false;
        lastError = error;
      }
    }

    // Everything that was tried failed. If it was all rate limits, say so plainly.
    throw allRateLimited ? new LlmProviderError("rate_limit", "Every chat model is rate limited.") : lastError;
  };
}
