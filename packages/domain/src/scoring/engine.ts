import { SIGNAL_TYPES, type SignalType } from "../evidence/index.js";
import type { ScoringConfig } from "./config.js";

// Phase 5 deterministic scoring engine. Pure functions only: no I/O, no
// clock, no randomness, no GitHub, no LLM. The same evidence and the same
// configuration always produce exactly the same result, regardless of input
// order. Nothing is rounded here; rounding is a presentation concern.

export class ScoringInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringInputError";
  }
}

// The subset of a Phase 4 EvidenceItem the scoring engine reads. Timestamps
// are deliberately absent so they can never influence a score.
export interface ScoringEvidence {
  // Optional identity, carried into the breakdown for traceability only.
  evidenceId?: string;
  repositoryId: string;
  skillId: string;
  signal: SignalType;
  normalizedStrength: number;
}

// Repository-level observations behind RepositorySubstance (Phase 3 values).
export interface RepositoryObservations {
  repositoryId: string;
  sourceFileCount: number;
  relevantStructureSignalCount: number;
}

export interface ScoringInput {
  evidence: readonly ScoringEvidence[];
  repositories: readonly RepositoryObservations[];
}

export interface SignalBreakdown {
  signal: SignalType;
  weight: number;
  applicable: boolean;
  // E_k(r,s): the maximum normalizedStrength among this signal's evidence
  // (0 when there is none). Reported even when the signal is not applicable.
  strength: number;
  meaningful: boolean;
  evidenceCount: number;
  evidenceIds: string[];
}

export interface RepositorySubstanceResult {
  repositoryId: string;
  sourceFileCount: number;
  relevantStructureSignalCount: number;
  sourceDepth: number;
  structureDepth: number;
  substanceRaw: number;
  substance: number;
}

export interface RepositorySkillScoreResult {
  repositoryId: string;
  skillId: string;
  signals: SignalBreakdown[];
  applicableWeightSum: number;
  baseScore: number;
  meaningfulSignalCount: number;
  breadthFactor: number;
  score: number;
}

export interface SkillContribution {
  repositoryId: string;
  rank: number;
  repositorySkillScore: number;
  repositorySubstance: number;
  rankMultiplier: number;
  contributionWeight: number;
}

export interface ExcludedRepository {
  repositoryId: string;
  repositorySkillScore: number;
}

export interface SkillScoreResult {
  skillId: string;
  // FinalSkillScore(s), unrounded and clamped to [0, 100].
  score: number;
  contributions: SkillContribution[];
  // Repositories with a positive score that ranked below the top-N cutoff.
  excludedByRank: ExcludedRepository[];
  contributionWeightSum: number;
}

export interface ScoringResult {
  scoringVersion: string;
  repositorySubstances: RepositorySubstanceResult[];
  repositorySkillScores: RepositorySkillScoreResult[];
  skillScores: SkillScoreResult[];
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// BreadthFactor(C): the factor of the highest tier whose threshold C reaches.
export function breadthFactor(meaningfulSignalCount: number, config: ScoringConfig): number {
  let factor = config.breadthFactors.noMeaningfulSignal;

  for (const tier of config.breadthFactors.tiers) {
    if (meaningfulSignalCount >= tier.minMeaningfulSignals) {
      factor = tier.factor;
    }
  }

  return factor;
}

// RankMultiplier(i) = rankDecay^(i-1), for 1-based rank i.
export function rankMultiplier(rank: number, config: ScoringConfig): number {
  return Math.pow(config.aggregation.rankDecay, rank - 1);
}

// RepositorySubstance(r) = floor + span * (0.70*sourceDepth + 0.30*structureDepth)
// It describes observable project surface only; it is not a quality measure.
export function computeRepositorySubstance(
  observations: RepositoryObservations,
  config: ScoringConfig,
): RepositorySubstanceResult {
  const { sourceFileCount, relevantStructureSignalCount } = observations;
  const parameters = config.repositorySubstance;

  if (!Number.isFinite(sourceFileCount) || sourceFileCount < 0) {
    throw new ScoringInputError(
      `Repository "${observations.repositoryId}" has an invalid sourceFileCount.`,
    );
  }
  if (!Number.isFinite(relevantStructureSignalCount) || relevantStructureSignalCount < 0) {
    throw new ScoringInputError(
      `Repository "${observations.repositoryId}" has an invalid relevantStructureSignalCount.`,
    );
  }

  const sourceDepth = Math.min(
    Math.log(1 + sourceFileCount) / Math.log(1 + parameters.sourceFileReference),
    1,
  );
  const structureDepth = Math.min(
    relevantStructureSignalCount / parameters.structureSignalReference,
    1,
  );
  const substanceRaw =
    parameters.sourceDepthWeight * sourceDepth + parameters.structureDepthWeight * structureDepth;
  const substance = clamp(parameters.floor + parameters.span * substanceRaw, parameters.floor, 1);

  return {
    repositoryId: observations.repositoryId,
    sourceFileCount,
    relevantStructureSignalCount,
    sourceDepth,
    structureDepth,
    substanceRaw,
    substance,
  };
}

// Scores one (repository, skill) pair from that pair's evidence items.
//
//   E_k        = max normalizedStrength of the signal's evidence
//   BaseScore  = 100 * sum(W_k*A_k*E_k) / sum(W_k*A_k)    (0 if the denominator is 0)
//   C          = count of applicable signals with E_k >= threshold
//   Score      = BaseScore * BreadthFactor(C)
export function scoreRepositorySkill(
  repositoryId: string,
  skillId: string,
  evidence: readonly ScoringEvidence[],
  config: ScoringConfig,
): RepositorySkillScoreResult {
  const applicable = new Set(config.applicability[skillId] ?? []);
  const signals: SignalBreakdown[] = [];

  let numerator = 0;
  let denominator = 0;
  let meaningfulSignalCount = 0;

  // Iterating SIGNAL_TYPES (a fixed tuple) fixes the summation order.
  for (const signal of SIGNAL_TYPES) {
    const items = evidence.filter((item) => item.signal === signal);
    const strength = items.reduce((max, item) => Math.max(max, item.normalizedStrength), 0);
    const isApplicable = applicable.has(signal);
    const meaningful = isApplicable && strength >= config.meaningfulSignalThreshold;
    const weight = config.signalWeights[signal];

    if (isApplicable) {
      numerator += weight * strength;
      denominator += weight;
    }
    if (meaningful) {
      meaningfulSignalCount += 1;
    }

    signals.push({
      signal,
      weight,
      applicable: isApplicable,
      strength,
      meaningful,
      evidenceCount: items.length,
      evidenceIds: items
        .map((item) => item.evidenceId)
        .filter((id): id is string => typeof id === "string")
        .sort(compareStrings),
    });
  }

  const baseScore = denominator > 0 ? (100 * numerator) / denominator : 0;
  const factor = breadthFactor(meaningfulSignalCount, config);

  return {
    repositoryId,
    skillId,
    signals,
    applicableWeightSum: denominator,
    baseScore,
    meaningfulSignalCount,
    breadthFactor: factor,
    score: clamp(baseScore * factor, 0, 100),
  };
}

// FinalSkillScore(s) from per-repository scores:
// drop zero scores, rank by score (ties by repositoryId), keep the top N, then
//   sum(score_i * W_i) / sum(W_i),  W_i = substance_i * decay^(i-1).
export function aggregateSkill(
  skillId: string,
  repositoryScores: readonly RepositorySkillScoreResult[],
  substances: ReadonlyMap<string, RepositorySubstanceResult>,
  config: ScoringConfig,
): SkillScoreResult | null {
  const ranked = repositoryScores
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || compareStrings(a.repositoryId, b.repositoryId));

  if (ranked.length === 0) {
    return null;
  }

  const top = ranked.slice(0, config.aggregation.topRepositories);
  const contributions: SkillContribution[] = top.map((entry, index) => {
    const substance = substances.get(entry.repositoryId);

    if (!substance) {
      throw new ScoringInputError(`Repository "${entry.repositoryId}" has no observations.`);
    }

    const rank = index + 1;
    const multiplier = rankMultiplier(rank, config);

    return {
      repositoryId: entry.repositoryId,
      rank,
      repositorySkillScore: entry.score,
      repositorySubstance: substance.substance,
      rankMultiplier: multiplier,
      contributionWeight: substance.substance * multiplier,
    };
  });

  let weightedScores = 0;
  let weightSum = 0;
  for (const contribution of contributions) {
    weightedScores += contribution.repositorySkillScore * contribution.contributionWeight;
    weightSum += contribution.contributionWeight;
  }

  return {
    skillId,
    score: clamp(weightedScores / weightSum, 0, 100),
    contributions,
    excludedByRank: ranked.slice(config.aggregation.topRepositories).map((entry) => ({
      repositoryId: entry.repositoryId,
      repositorySkillScore: entry.score,
    })),
    contributionWeightSum: weightSum,
  };
}

// Scores every skill that has evidence. Input order never matters: evidence is
// grouped by identifier and every output list is sorted explicitly.
export function scoreSkills(input: ScoringInput, config: ScoringConfig): ScoringResult {
  const observationsByRepository = new Map<string, RepositoryObservations>();

  for (const observations of input.repositories) {
    if (observationsByRepository.has(observations.repositoryId)) {
      throw new ScoringInputError(`Duplicate observations for repository "${observations.repositoryId}".`);
    }
    observationsByRepository.set(observations.repositoryId, observations);
  }

  const grouped = new Map<string, Map<string, ScoringEvidence[]>>();

  for (const item of input.evidence) {
    if (!Number.isFinite(item.normalizedStrength) || item.normalizedStrength < 0 || item.normalizedStrength > 1) {
      throw new ScoringInputError(
        `Evidence for skill "${item.skillId}" has normalizedStrength outside [0, 1].`,
      );
    }
    if (!(SIGNAL_TYPES as readonly string[]).includes(item.signal)) {
      throw new ScoringInputError(`Evidence for skill "${item.skillId}" has unknown signal "${item.signal}".`);
    }
    if (!config.applicability[item.skillId]) {
      throw new ScoringInputError(`Evidence references unknown skill "${item.skillId}".`);
    }
    if (!observationsByRepository.has(item.repositoryId)) {
      throw new ScoringInputError(
        `Evidence references repository "${item.repositoryId}" that has no observations.`,
      );
    }

    const bySkill = grouped.get(item.skillId) ?? new Map<string, ScoringEvidence[]>();
    const items = bySkill.get(item.repositoryId) ?? [];
    items.push(item);
    bySkill.set(item.repositoryId, items);
    grouped.set(item.skillId, bySkill);
  }

  const substances = new Map<string, RepositorySubstanceResult>();
  for (const repositoryId of [...observationsByRepository.keys()].sort(compareStrings)) {
    substances.set(
      repositoryId,
      computeRepositorySubstance(observationsByRepository.get(repositoryId)!, config),
    );
  }

  const repositorySkillScores: RepositorySkillScoreResult[] = [];
  const skillScores: SkillScoreResult[] = [];

  for (const skillId of [...grouped.keys()].sort(compareStrings)) {
    const bySkill = grouped.get(skillId)!;
    const scores = [...bySkill.keys()]
      .sort(compareStrings)
      .map((repositoryId) => scoreRepositorySkill(repositoryId, skillId, bySkill.get(repositoryId)!, config));

    repositorySkillScores.push(...scores);

    const skillScore = aggregateSkill(skillId, scores, substances, config);
    if (skillScore) {
      skillScores.push(skillScore);
    }
  }

  return {
    scoringVersion: config.scoringVersion,
    repositorySubstances: [...substances.values()],
    repositorySkillScores,
    skillScores,
  };
}
