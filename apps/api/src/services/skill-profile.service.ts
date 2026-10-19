import {
  findSkill,
  type RepositorySkillScoreResult,
  type ScoringResult,
  type SignalBreakdown,
  type SkillScoreResult,
  type SkillTaxonomy,
} from "@nexus/domain";
import { loadEvidenceConfig } from "../evidence/evidence-config.js";
import { AnalysisModel } from "../models/analysis.model.js";
import { RepositoryModel } from "../models/repository.model.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

// Read-side Phase 6 service. It only reads the persisted Phase 5 scoring
// result; it never scores, aggregates or re-weights anything itself.

export interface AnalysisSummary {
  analysisId: string;
  scoringVersion: string;
  createdAt: string;
  repositoryCount: number;
  evidenceCount: number;
}

export interface LatestAnalysis {
  summary: AnalysisSummary;
  result: ScoringResult;
}

// not-analyzed: the user has no persisted scoring run at all.
// no-evidence: a scoring run exists but produced no score for this skill.
// scored: the scoring run produced a score for this skill.
export type SkillScoreStatus = "not-analyzed" | "no-evidence" | "scored";

export interface SkillOverviewItem {
  id: string;
  displayName: string;
  categoryId: string;
  score: number | null;
  status: SkillScoreStatus;
  repositoryCount: number;
}

export interface SkillOverview {
  analysis: AnalysisSummary | null;
  categories: Array<{
    id: string;
    displayName: string;
    skills: SkillOverviewItem[];
  }>;
}

export interface RepositoryReference {
  id: string;
  fullName: string | null;
  url: string | null;
}

export interface RepositoryScoreDetail {
  repository: RepositoryReference;
  repositorySkillScore: number;
  baseScore: number;
  breadthFactor: number;
  meaningfulSignalCount: number;
  applicableWeightSum: number;
  signals: SignalBreakdown[];
}

export interface ContributionDetail extends RepositoryScoreDetail {
  rank: number;
  repositorySubstance: number;
  rankMultiplier: number;
  contributionWeight: number;
}

export interface SkillDetail {
  skill: { id: string; displayName: string; categoryId: string; categoryName: string };
  analysis: AnalysisSummary | null;
  status: SkillScoreStatus;
  score: number | null;
  contributionWeightSum: number | null;
  contributions: ContributionDetail[];
  // Repositories with a positive score that ranked below the top-N cutoff.
  // They did NOT contribute to the final score.
  excludedRepositories: RepositoryScoreDetail[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The persisted result is stored as Mixed, so its shape is verified before it
// is trusted. A malformed stored analysis is an internal error, never data.
export function readScoringResult(raw: unknown): ScoringResult {
  if (
    !isObject(raw) ||
    typeof raw.scoringVersion !== "string" ||
    !Array.isArray(raw.skillScores) ||
    !Array.isArray(raw.repositorySkillScores)
  ) {
    throw new AppError(AuthErrorCode.INVALID_ANALYSIS, 500, "The stored analysis is malformed.");
  }

  for (const skillScore of raw.skillScores) {
    if (
      !isObject(skillScore) ||
      typeof skillScore.skillId !== "string" ||
      typeof skillScore.score !== "number" ||
      !Number.isFinite(skillScore.score) ||
      !Array.isArray(skillScore.contributions)
    ) {
      throw new AppError(AuthErrorCode.INVALID_ANALYSIS, 500, "The stored analysis is malformed.");
    }
  }

  return raw as unknown as ScoringResult;
}

// Latest scoring run for the user, or null when none exists. Always scoped by
// userId.
export async function getLatestAnalysis(userId: string): Promise<LatestAnalysis | null> {
  const document = await AnalysisModel.findOne({ userId }).sort({ createdAt: -1 }).lean();

  if (!document) {
    return null;
  }

  return {
    summary: {
      analysisId: String(document._id),
      scoringVersion: document.scoringVersion,
      createdAt: new Date(document.createdAt).toISOString(),
      repositoryCount: document.repositoryIds.length,
      evidenceCount: document.evidenceCount,
    },
    result: readScoringResult(document.result),
  };
}

function statusFor(latest: LatestAnalysis | null, score: SkillScoreResult | undefined): SkillScoreStatus {
  if (!latest) {
    return "not-analyzed";
  }
  return score ? "scored" : "no-evidence";
}

export async function getSkillOverview(userId: string): Promise<SkillOverview> {
  const { taxonomy } = loadEvidenceConfig();
  const latest = await getLatestAnalysis(userId);
  const scores = new Map<string, SkillScoreResult>(
    (latest?.result.skillScores ?? []).map((score) => [score.skillId, score]),
  );

  return {
    analysis: latest?.summary ?? null,
    categories: taxonomy.categories.map((category) => ({
      id: category.id,
      displayName: category.displayName,
      skills: category.skillIds.map((skillId) => {
        const skill = findSkill(taxonomy, skillId)!;
        const score = scores.get(skillId);

        return {
          id: skill.id,
          displayName: skill.displayName,
          categoryId: skill.categoryId,
          score: score ? score.score : null,
          status: statusFor(latest, score),
          repositoryCount: score ? score.contributions.length : 0,
        };
      }),
    })),
  };
}

async function repositoryReferences(
  userId: string,
  repositoryIds: string[],
): Promise<Map<string, RepositoryReference>> {
  if (repositoryIds.length === 0) {
    return new Map();
  }

  const documents = await RepositoryModel.find({ userId, _id: { $in: repositoryIds } }).lean();

  return new Map(
    documents.map((document) => [
      String(document._id),
      { id: String(document._id), fullName: document.fullName, url: document.url },
    ]),
  );
}

function categoryName(taxonomy: SkillTaxonomy, categoryId: string): string {
  return taxonomy.categories.find((category) => category.id === categoryId)?.displayName ?? categoryId;
}

export async function getSkillDetail(userId: string, skillId: string): Promise<SkillDetail> {
  const { taxonomy } = loadEvidenceConfig();
  const skill = findSkill(taxonomy, skillId);

  if (!skill) {
    throw new AppError(AuthErrorCode.SKILL_NOT_FOUND, 404, "Skill not found.");
  }

  const latest = await getLatestAnalysis(userId);
  const score = latest?.result.skillScores.find((entry) => entry.skillId === skillId);
  const perRepository = new Map<string, RepositorySkillScoreResult>(
    (latest?.result.repositorySkillScores ?? [])
      .filter((entry) => entry.skillId === skillId)
      .map((entry) => [entry.repositoryId, entry]),
  );

  const involved = [
    ...(score?.contributions.map((entry) => entry.repositoryId) ?? []),
    ...(score?.excludedByRank.map((entry) => entry.repositoryId) ?? []),
  ];
  const references = await repositoryReferences(userId, involved);
  const referenceFor = (repositoryId: string): RepositoryReference =>
    references.get(repositoryId) ?? { id: repositoryId, fullName: null, url: null };

  const detailFor = (repositoryId: string): RepositoryScoreDetail => {
    const entry = perRepository.get(repositoryId);

    return {
      repository: referenceFor(repositoryId),
      repositorySkillScore: entry?.score ?? 0,
      baseScore: entry?.baseScore ?? 0,
      breadthFactor: entry?.breadthFactor ?? 0,
      meaningfulSignalCount: entry?.meaningfulSignalCount ?? 0,
      applicableWeightSum: entry?.applicableWeightSum ?? 0,
      signals: entry?.signals ?? [],
    };
  };

  return {
    skill: {
      id: skill.id,
      displayName: skill.displayName,
      categoryId: skill.categoryId,
      categoryName: categoryName(taxonomy, skill.categoryId),
    },
    analysis: latest?.summary ?? null,
    status: statusFor(latest, score),
    score: score ? score.score : null,
    contributionWeightSum: score ? score.contributionWeightSum : null,
    contributions: (score?.contributions ?? []).map((contribution) => ({
      ...detailFor(contribution.repositoryId),
      // The contribution record is the authority for these values.
      repositorySkillScore: contribution.repositorySkillScore,
      rank: contribution.rank,
      repositorySubstance: contribution.repositorySubstance,
      rankMultiplier: contribution.rankMultiplier,
      contributionWeight: contribution.contributionWeight,
    })),
    excludedRepositories: (score?.excludedByRank ?? []).map((excluded) => ({
      ...detailFor(excluded.repositoryId),
      repositorySkillScore: excluded.repositorySkillScore,
    })),
  };
}
