import { env } from "../config/env.js";
import { analyzeRepository } from "../analyzer/repository-analyzer.js";
import type { RepositoryAnalysis } from "../analyzer/types.js";
import type { BuildEvidenceResult } from "../evidence/evidence-builder.js";
import { RepositoryModel } from "../models/repository.model.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { generateRepositoryEvidence } from "./evidence.service.js";
import { mapToObject } from "./github-repository.service.js";

export interface AnalyzedRepository {
  analysis: RepositoryAnalysis;
  evidence: BuildEvidenceResult;
}

// Phase 3 analysis is ownership-scoped and selection-scoped: a user can only
// trigger analysis for a repository that (a) belongs to them and (b) they
// have explicitly selected (see github-selection.service.ts), mirroring the
// same enforcement Phase 2 already applies to repository detail access.
export async function analyzeSelectedRepository(
  userId: string,
  repositoryId: string,
  accessToken: string,
): Promise<AnalyzedRepository> {
  const repo = await RepositoryModel.findOne({ _id: repositoryId, userId });

  if (!repo) {
    throw new AppError(AuthErrorCode.REPOSITORY_NOT_FOUND, 404, "Repository not found.");
  }

  if (!repo.selected) {
    throw new AppError(
      AuthErrorCode.REPOSITORY_NOT_SELECTED,
      400,
      "Repository must be selected before it can be analyzed.",
    );
  }

  const analysis = await analyzeRepository({
    accessToken,
    repositoryId,
    context: {
      owner: repo.owner,
      name: repo.name,
      defaultBranch: repo.metadata?.defaultBranch ?? "main",
    },
    cachedLanguages: mapToObject(repo.languages),
    requestBudgetLimit: env.MAX_REQUESTS_PER_REPOSITORY,
  });

  repo.analyzed = true;
  repo.analyzedAt = new Date();

  const hasCachedLanguages = Boolean(repo.languages && repo.languages.size > 0);
  const hasFreshLanguages = Object.keys(analysis.languages.bytesByLanguage).length > 0;

  if (!hasCachedLanguages && hasFreshLanguages) {
    repo.languages = new Map(Object.entries(analysis.languages.bytesByLanguage));
  }

  await repo.save();

  // Phase 4: derive and persist EvidenceItems from the observations Phase 3
  // just produced. No additional GitHub requests are made.
  const evidence = await generateRepositoryEvidence(userId, analysis);

  return { analysis, evidence };
}
