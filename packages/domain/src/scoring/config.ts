import { z } from "zod";
import { SIGNAL_TYPES, type SignalType } from "../evidence/index.js";

// Phase 5 scoring configuration. The data lives in config/scoring.json; this
// module defines its shape and strict validation so it stays free of any
// filesystem, Express or MongoDB dependency. Invalid configuration is never
// repaired or normalized: it fails with ScoringConfigError.

const WEIGHT_SUM_TOLERANCE = 1e-9;

export class ScoringConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringConfigError";
  }
}

const weight = z.number().finite().min(0);
const unitInterval = z.number().finite().min(0).max(1);
const positiveInt = z.number().int().positive();

const signalWeightsShape = Object.fromEntries(SIGNAL_TYPES.map((signal) => [signal, weight])) as Record<
  SignalType,
  typeof weight
>;

export const scoringConfigSchema = z.object({
  scoringVersion: z.string().min(1),
  signalWeights: z.object(signalWeightsShape).strict(),
  meaningfulSignalThreshold: z.number().finite().gt(0).max(1),
  breadthFactors: z.object({
    noMeaningfulSignal: unitInterval,
    tiers: z
      .array(z.object({ minMeaningfulSignals: positiveInt, factor: z.number().finite().gt(0).max(1) }).strict())
      .min(1),
  }).strict(),
  repositorySubstance: z.object({
    sourceFileReference: positiveInt,
    structureSignalReference: positiveInt,
    sourceDepthWeight: weight,
    structureDepthWeight: weight,
    floor: unitInterval,
    span: unitInterval,
  }).strict(),
  aggregation: z.object({
    topRepositories: positiveInt,
    rankDecay: z.number().finite().gt(0).max(1),
  }).strict(),
  applicability: z.record(z.string().min(1), z.array(z.enum(SIGNAL_TYPES))),
});

export interface BreadthTier {
  minMeaningfulSignals: number;
  factor: number;
}

export interface ScoringConfig {
  scoringVersion: string;
  signalWeights: Record<SignalType, number>;
  meaningfulSignalThreshold: number;
  breadthFactors: {
    // Factor used when no applicable signal reaches the meaningful threshold.
    noMeaningfulSignal: number;
    // Ascending by minMeaningfulSignals.
    tiers: BreadthTier[];
  };
  repositorySubstance: {
    sourceFileReference: number;
    structureSignalReference: number;
    sourceDepthWeight: number;
    structureDepthWeight: number;
    floor: number;
    span: number;
  };
  aggregation: { topRepositories: number; rankDecay: number };
  // Skill id -> the signals that apply to it (A_k(r,s) = 1).
  applicability: Record<string, SignalType[]>;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= WEIGHT_SUM_TOLERANCE;
}

// Validates raw scoring data against the schema and every cross-field
// invariant. `skillIds` is the set of skills in the taxonomy; the applicability
// matrix must cover exactly those skills.
export function parseScoringConfig(raw: unknown, skillIds: readonly string[]): ScoringConfig {
  const parsed = scoringConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ScoringConfigError(`Invalid scoring configuration: ${details}`);
  }

  const config = parsed.data as ScoringConfig;
  const fail = (message: string): never => {
    throw new ScoringConfigError(`Invalid scoring configuration: ${message}`);
  };

  const weightSum = SIGNAL_TYPES.reduce((sum, signal) => sum + config.signalWeights[signal], 0);
  if (!nearlyEqual(weightSum, 1)) {
    fail(`signalWeights must sum to 1 (got ${weightSum}).`);
  }

  let previousMin = 0;
  let previousFactor = 0;
  for (const tier of config.breadthFactors.tiers) {
    if (tier.minMeaningfulSignals <= previousMin) {
      fail("breadthFactors.tiers must have strictly ascending minMeaningfulSignals.");
    }
    if (tier.factor < previousFactor) {
      fail("breadthFactors.tiers factors must not decrease.");
    }
    previousMin = tier.minMeaningfulSignals;
    previousFactor = tier.factor;
  }
  if (config.breadthFactors.tiers[0]!.minMeaningfulSignals !== 1) {
    fail("the first breadth tier must start at 1 meaningful signal.");
  }
  if (config.breadthFactors.noMeaningfulSignal > config.breadthFactors.tiers[0]!.factor) {
    fail("breadthFactors.noMeaningfulSignal must not exceed the first tier factor.");
  }

  const substance = config.repositorySubstance;
  if (!nearlyEqual(substance.sourceDepthWeight + substance.structureDepthWeight, 1)) {
    fail("repositorySubstance depth weights must sum to 1.");
  }
  if (!nearlyEqual(substance.floor + substance.span, 1)) {
    fail("repositorySubstance floor + span must equal 1 so substance stays within [floor, 1].");
  }

  const known = new Set(skillIds);
  for (const skillId of Object.keys(config.applicability)) {
    if (!known.has(skillId)) {
      fail(`applicability references unknown skill "${skillId}".`);
    }
  }
  for (const skillId of skillIds) {
    const signals = config.applicability[skillId];
    if (!signals) {
      fail(`applicability is missing skill "${skillId}".`);
    } else if (new Set(signals).size !== signals.length) {
      fail(`applicability for skill "${skillId}" lists a signal more than once.`);
    }
  }

  return config;
}
