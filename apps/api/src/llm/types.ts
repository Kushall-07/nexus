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

export interface LLMProvider {
  explainGapAnalysis(request: GapExplanationRequest): Promise<GapExplanation>;
  // Optional Phase 12 capability: returns an UNVALIDATED candidate intent for a user message.
  extractCopilotIntent?(message: string): Promise<unknown>;
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
