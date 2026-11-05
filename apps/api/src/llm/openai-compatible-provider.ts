import { z } from "zod";
import { buildExplanationMessages, buildIntentMessages } from "./prompt.js";
import { gapExplanationSchema, LlmProviderError, type GapExplanation, type LlmFailureDetails, type GapExplanationRequest, type LLMProvider } from "./types.js";

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  // Provider name used only in diagnostics.
  label?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const MAX_OUTPUT_TOKENS = 1200;
const MAX_RESPONSE_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 20_000;

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

// Reads at most `maxChars` of a response body and cancels the rest, so an
// oversized or endless upstream body can never be buffered in full.
async function readBounded(response: Response, maxChars: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) return { text: text + decoder.decode(), truncated: false };

      text += decoder.decode(value, { stream: true });

      if (text.length > maxChars) {
        await reader.cancel().catch(() => undefined);
        return { text: text.slice(0, maxChars), truncated: true };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Pulls a short machine-readable code (e.g. "model_not_found", "invalid_api_key",
// "NOT_FOUND") from an upstream error body. Anything else is discarded.
function safeUpstreamCode(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    const error = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: Record<string, unknown> } | undefined;
    const candidate = error?.error?.code ?? error?.error?.status ?? error?.error?.type;

    return typeof candidate === "string" || typeof candidate === "number"
      ? String(candidate).match(/^[\w.\-]{1,64}$/)?.[0]
      : undefined;
  } catch {
    return undefined;
  }
}

function failureForStatus(status: number, details: LlmFailureDetails): LlmProviderError {
  const withStatus = { ...details, status };

  if (status === 401 || status === 403) return new LlmProviderError("auth", "Provider rejected the credentials.", withStatus);
  if (status === 429) return new LlmProviderError("rate_limit", "Provider rate limit reached.", withStatus);
  if (status >= 400 && status < 500) {
    return new LlmProviderError("bad_request", `Provider rejected the request (status ${status}).`, withStatus);
  }
  return new LlmProviderError("server", `Provider responded with status ${status}.`, withStatus);
}

// Works with any chat-completions endpoint in the OpenAI wire format (Groq and
// Gemini both offer one). One request, no retries, hard timeout.
export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LLMProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const details: LlmFailureDetails = { provider: config.label };
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  // One request, no retries, hard timeout. Returns the raw message content.
  async function requestContent(messages: Array<{ role: string; content: string }>, maxTokens: number): Promise<string> {
    let response: Response;

    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new LlmProviderError(timedOut ? "timeout" : "network", "Provider request failed.", details);
    }

    if (!response.ok) {
      const body = await readBounded(response, 4000).catch(() => ({ text: "", truncated: true }));
      throw failureForStatus(response.status, { ...details, upstreamCode: safeUpstreamCode(body.text) });
    }

    try {
      const { text: raw, truncated } = await readBounded(response, MAX_RESPONSE_CHARS);
      if (truncated) throw new Error("oversized");
      const content = completionSchema.parse(JSON.parse(raw)).choices[0]!.message.content;
      if (content.length > MAX_RESPONSE_CHARS) throw new Error("oversized");
      return content;
    } catch {
      throw new LlmProviderError("invalid_response", "Provider returned an unreadable response.", details);
    }
  }

  return {
    async explainGapAnalysis(request: GapExplanationRequest): Promise<GapExplanation> {
      const content = await requestContent(buildExplanationMessages(request), MAX_OUTPUT_TOKENS);

      try {
        return gapExplanationSchema.parse(JSON.parse(content));
      } catch {
        throw new LlmProviderError("invalid_response", "Provider output failed validation.", details);
      }
    },

    // Phase 12: turns ONE user message into a candidate intent object. The
    // caller validates it against a closed schema; it is never executed as-is.
    async extractCopilotIntent(message: string): Promise<unknown> {
      const content = await requestContent(buildIntentMessages(message), 300);

      try {
        return JSON.parse(content) as unknown;
      } catch {
        throw new LlmProviderError("invalid_response", "Provider output was not JSON.", details);
      }
    },
  };
}
