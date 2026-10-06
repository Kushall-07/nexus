import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import type { RepositoryAnalysis } from "../analyzer/types.js";
import { analyzeSelectedRepository } from "../services/github-analysis.service.js";
import { getDecryptedGithubToken } from "../services/github-token.service.js";
import type { BuildEvidenceResult } from "../evidence/evidence-builder.js";
import { toPublicEvidence } from "../services/evidence.service.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const repositoryIdParamSchema = z.object({
  id: z.string().refine((value) => mongoose.isValidObjectId(value), {
    message: "Invalid repository id.",
  }),
});

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(AuthErrorCode.UNAUTHORIZED, 401, "Authentication required.");
  }

  return req.user;
}

// Shapes the normalized RepositoryAnalysis into the response structure
// described by the frozen spec (section 49): repository identity separated
// from the analysis payload, with the raw GitHub access token never anywhere
// near this response.
function toAnalysisResponse(analysis: RepositoryAnalysis, evidence: BuildEvidenceResult) {
  return {
    repository: {
      id: analysis.repositoryId,
      fullName: analysis.repositoryFullName,
    },
    analysis: {
      analyzedAt: analysis.analyzedAt,
      languages: analysis.languages,
      dependencies: analysis.dependencies,
      frameworks: analysis.frameworks,
      sourceUsage: analysis.sourceUsage,
      projectStructure: analysis.projectStructure,
      docker: analysis.docker,
      testing: analysis.testing,
      documentation: analysis.documentation,
      activity: analysis.activity,
      requestBudget: analysis.requestBudget,
    },
    // Phase 4 evidence derived from the observations above. Evidence only
    // describes what was observed; it carries no skill score.
    evidence: {
      items: evidence.items.map(toPublicEvidence),
      unmappedTechnologies: evidence.unmappedTechnologies,
    },
    warnings: analysis.warnings,
  };
}

// This is a Phase 3-scoped analysis surface: it produces normalized
// repository observations only. It deliberately does not score skills,
// match roles, or run gap analysis — that belongs to the later full
// `/api/analysis/run` pipeline reserved for Phase 5+.
export async function analyzeRepositoryHandler(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);

  const paramsResult = repositoryIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    throw new AppError(AuthErrorCode.VALIDATION_ERROR, 400, "Invalid repository id.");
  }

  const accessToken = await getDecryptedGithubToken(user.id);
  const { analysis, evidence } = await analyzeSelectedRepository(
    user.id,
    paramsResult.data.id,
    accessToken,
  );

  res.status(200).json({ success: true, data: toAnalysisResponse(analysis, evidence) });
}
