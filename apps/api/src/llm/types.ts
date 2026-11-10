import { z } from "zod";

// Phase 8 explanation contracts. The request is built only from the stored,
// deterministic gap analysis; the response is untrusted model output and is
// validated before it reaches the browser.

export interface ExplanationSkill {
  skillId: string;
  skillName: string;
  evidenceScore: number;
  evidenceAvailable: boolean;
  minimumScore: number;
  weight: number;
  gap: number;
  deficit: number;
  criticalGap: boolean;
}

export interface GapExplanationRequest {
  roleId: string;
  roleName: string;
  roleMatch: number;
  roleCatalogVersion: string;
  scoringVersion: string;
  skills: ExplanationSkill[];
}

export const gapExplanationSchema = z
  .object({
    summary: z.string().trim().min(1).max(1200),
    strengths: z.array(z.string().trim().min(1).max(400)).max(5),
    priorityGaps: z
      .array(z.object({ skillId: z.string().min(1).max(64), explanation: z.string().trim().min(1).max(500) }).strict())
      .max(5),
    recommendedActions: z.array(z.string().trim().min(1).max(400)).min(1).max(6),
    limitations: z.array(z.string().trim().min(1).max(400)).min(1).max(4),
  })
  .strict();

export type GapExplanation = z.infer<typeof gapExplanationSchema>;

// Free-form conversation with optional tool calling (OpenAI chat-completions wire format).
export interface ToolCall {
  id: string;
  name: string;
  // Raw JSON string produced by the model. It is untrusted and must be parsed and validated by the caller.
  arguments: string;
  // Provider-specific data that must be sent back unchanged with the tool result (Gemini 3 "thought signatures").
  extra?: Record<string, unknown>;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ToolDefinition {
  name: string;
  description: string;
  // JSON Schema for the arguments object.
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  explainGapAnalysis(request: GapExplanationRequest): Promise<GapExplanation>;
  // Optional Phase 12 capability: returns an UNVALIDATED candidate intent for a user message.
  extractCopilotIntent?(message: string): Promise<unknown>;
  // Optional conversational capability used by the Copilot agent.
  chat?(request: ChatRequest): Promise<ChatResult>;
}

export type LlmFailureKind = "auth" | "rate_limit" | "bad_request" | "timeout" | "network" | "server" | "invalid_response";

// Safe diagnostics only: never a raw upstream body, header or key.
export interface LlmFailureDetails {
  provider?: string;
  status?: number;
  upstreamCode?: string;
}

export class LlmProviderError extends Error {
  public readonly kind: LlmFailureKind;
  public readonly details: LlmFailureDetails;

  constructor(kind: LlmFailureKind, message: string, details: LlmFailureDetails = {}) {
    super(message);
    this.name = "LlmProviderError";
    this.kind = kind;
    this.details = details;
  }
}
