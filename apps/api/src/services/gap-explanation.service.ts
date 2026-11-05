import { getLlmProvider } from "../llm/provider.js";
import { EXPLANATION_PROMPT_VERSION } from "../llm/prompt.js";
import {
  gapExplanationSchema,
  LlmProviderError,
  type GapExplanation,
  type GapExplanationRequest,
} from "../llm/types.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { getGapAnalysis, type GapAnalysisDto } from "./gap-analysis.service.js";

// Phase 8. Explains an already-computed, persisted gap analysis. Nothing here
// scores, ranks or writes: the model only receives and describes stored values.

export interface GapExplanationResult {
  gapAnalysisId: string;
  roleId: string;
  promptVersion: string;
  generatedAt: string;
  explanation: GapExplanation;
}

export function buildExplanationRequest(analysis: GapAnalysisDto): GapExplanationRequest {
  return {
    roleId: analysis.roleId,
    roleName: analysis.roleName,
    roleMatch: analysis.roleMatch,
    roleCatalogVersion: analysis.roleCatalogVersion,
    scoringVersion: analysis.scoringVersion,
    skills: analysis.requirements.map((entry) => ({
      skillId: entry.skillId,
      skillName: entry.skillName,
      evidenceScore: entry.evidenceScore,
      evidenceAvailable: entry.evidenceAvailable,
      minimumScore: entry.minimumScore,
      weight: entry.weight,
      gap: entry.gap,
      deficit: entry.deficit,
      criticalGap: entry.criticalGap,
    })),
  };
}

function invalidResponse(): AppError {
  return new AppError(AuthErrorCode.LLM_INVALID_RESPONSE, 502, "The explanation could not be generated. Please try again.");
}

function toAppError(error: unknown, durationMs: number): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof LlmProviderError) {
    // Provider, category, HTTP status and a sanitized upstream code only:
    // never provider bodies, prompts or credentials.
    console.error("LLM explanation failed:", { kind: error.kind, ...error.details, durationMs });

    if (error.kind === "rate_limit") {
      return new AppError(AuthErrorCode.LLM_RATE_LIMITED, 429, "The explanation service is busy. Please try again shortly.");
    }
    if (error.kind === "invalid_response") return invalidResponse();
  } else {
    console.error("LLM explanation failed: unexpected error");
  }

  return new AppError(AuthErrorCode.LLM_UNAVAILABLE, 503, "The explanation service is currently unavailable.");
}

// One provider call per (user, analysis) at a time: a double click or a retry
// while the first request is pending shares that call instead of spending
// more provider quota.
const inFlight = new Map<string, Promise<GapExplanationResult>>();

export function explainGapAnalysis(userId: string, gapAnalysisId: string): Promise<GapExplanationResult> {
  const key = `${userId}:${gapAnalysisId}`;
  const pending = inFlight.get(key);

  if (pending) return pending;

  const run = generateExplanation(userId, gapAnalysisId).finally(() => inFlight.delete(key));

  inFlight.set(key, run);

  return run;
}

async function generateExplanation(userId: string, gapAnalysisId: string): Promise<GapExplanationResult> {
  // Ownership-checked load of the stored deterministic result.
  const analysis = await getGapAnalysis(userId, gapAnalysisId);
  const provider = getLlmProvider();

  if (!provider) {
    throw new AppError(
      AuthErrorCode.LLM_NOT_CONFIGURED,
      503,
      "AI explanations are not configured on this server. Your scores and gap analysis are unaffected.",
    );
  }

  const request = buildExplanationRequest(analysis);
  let raw: unknown;
  const startedAt = Date.now();

  try {
    raw = await provider.explainGapAnalysis(request);
  } catch (error) {
    throw toAppError(error, Date.now() - startedAt);
  }

  const parsed = gapExplanationSchema.safeParse(raw);

  if (!parsed.success) throw invalidResponse();

  // Priority gaps must point at skills that exist in this analysis.
  const known = new Set(request.skills.map((skill) => skill.skillId));

  if (parsed.data.priorityGaps.some((gap) => !known.has(gap.skillId))) throw invalidResponse();

  return {
    gapAnalysisId: analysis.id,
    roleId: analysis.roleId,
    promptVersion: EXPLANATION_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    explanation: parsed.data,
  };
}
