import { createHash } from "node:crypto";
import {
  ScoringInputError,
  scoreSkills,
  type ScoringEvidence,
  type ScoringResult,
  type SignalType,
} from "@nexus/domain";
import { AnalysisModel } from "../models/analysis.model.js";
import { EvidenceModel } from "../models/evidence.model.js";
import { RepositoryModel } from "../models/repository.model.js";
import { loadScoringConfig } from "../scoring/scoring-config.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export interface ScoredAnalysis {
  analysisId: string;
  userId: string;
  scoringVersion: string;
  scoringConfigHash: string;
  repositoryIds: string[];
  // Analyzed repositories that have no stored observations (analyzed before
  // Phase 5) and therefore cannot be scored until they are analyzed again.
  skippedRepositoryIds: string[];
  evidenceCount: number;
  result: ScoringResult;
}

function configHash(): string {
  return createHash("sha256").update(JSON.stringify(loadScoringConfig())).digest("hex");
}

// Phase 5 orchestration: load the user's persisted evidence, run the pure
// scoring engine, persist the result. It never calls GitHub and never
// re-analyzes a repository. Every query is scoped by userId.
export async function scoreUserEvidence(userId: string): Promise<ScoredAnalysis> {
  const config = loadScoringConfig();

  const repositories = await RepositoryModel.find({ userId, analyzed: true }).lean();
  const scorable = repositories.filter((repository) => repository.scoringObservations);
  const skippedRepositoryIds = repositories
    .filter((repository) => !repository.scoringObservations)
    .map((repository) => String(repository._id))
    .sort();

  const repositoryIds = scorable.map((repository) => String(repository._id)).sort();

  const documents =
    repositoryIds.length > 0
      ? await EvidenceModel.find({ userId, repositoryId: { $in: repositoryIds } }).lean()
      : [];

  if (documents.length === 0) {
    throw new AppError(AuthErrorCode.NO_EVIDENCE, 404, "No evidence is available to score.");
  }

  const evidence: ScoringEvidence[] = documents.map((document) => ({
    evidenceId: String(document._id),
    repositoryId: String(document.repositoryId),
    skillId: document.skillId,
    signal: document.signal as SignalType,
    normalizedStrength: document.normalizedStrength,
  }));

  let result: ScoringResult;

  try {
    result = scoreSkills(
      {
        evidence,
        repositories: scorable.map((repository) => ({
          repositoryId: String(repository._id),
          sourceFileCount: repository.scoringObservations!.sourceFileCount,
          relevantStructureSignalCount: repository.scoringObservations!.relevantStructureSignalCount,
        })),
      },
      config,
    );
  } catch (error) {
    if (error instanceof ScoringInputError) {
      throw new AppError(AuthErrorCode.INVALID_EVIDENCE, 500, error.message);
    }
    throw error;
  }

  const hash = configHash();
  const analysis = await AnalysisModel.create({
    userId,
    scoringVersion: config.scoringVersion,
    scoringConfigHash: hash,
    repositoryIds,
    evidenceCount: evidence.length,
    result,
  });

  return {
    analysisId: String(analysis._id),
    userId,
    scoringVersion: config.scoringVersion,
    scoringConfigHash: hash,
    repositoryIds,
    skippedRepositoryIds,
    evidenceCount: evidence.length,
    result,
  };
}
