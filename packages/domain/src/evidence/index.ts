import { z } from "zod";

// Phase 4 evidence model. An EvidenceItem records that an observable
// repository artifact supports a skill. It is NOT a skill score:
// `normalizedStrength` only describes how strong this one piece of evidence
// is, within [0, 1]. Turning evidence into scores is a later phase.

export const EVIDENCE_TYPES = [
  "DEPENDENCY",
  "LANGUAGE",
  "FRAMEWORK",
  "SOURCE_FILE",
  "PROJECT_STRUCTURE",
  "DOCKER",
  "TEST",
  "README",
  "COMMIT_ACTIVITY",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const SIGNAL_TYPES = [
  "dependency",
  "framework",
  "sourceUsage",
  "projectStructure",
  "testing",
  "documentation",
  "activity",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

// The single place that decides which scoring signal each evidence type
// feeds. LANGUAGE share is a proxy for source usage; Docker files are a
// repository-structure artifact.
export const EVIDENCE_TYPE_SIGNAL: Record<EvidenceType, SignalType> = {
  DEPENDENCY: "dependency",
  LANGUAGE: "sourceUsage",
  FRAMEWORK: "framework",
  SOURCE_FILE: "sourceUsage",
  PROJECT_STRUCTURE: "projectStructure",
  DOCKER: "projectStructure",
  TEST: "testing",
  README: "documentation",
  COMMIT_ACTIVITY: "activity",
};

// The observed value behind the evidence: a name/identifier for categorical
// observations (e.g. a dependency name) or a count/percentage for numeric ones.
export type EvidenceValue = string | number;

export interface EvidenceItem {
  id: string;
  userId: string;
  repositoryId: string;
  skillId: string;
  evidenceType: EvidenceType;
  signal: SignalType;
  value: EvidenceValue;
  normalizedStrength: number;
  sourcePath?: string;
  sourceReference?: string;
  explanation: string;
  detectedAt: Date;
}

// An evidence item as produced by the engine, before persistence assigns an id.
// `observationKey` is the canonical identity of the underlying observation
// (e.g. "dependency:react:runtime"); together with skill, type and source it
// forms the deterministic evidence key.
export interface NewEvidenceItem extends Omit<EvidenceItem, "id"> {
  observationKey: string;
}

export const evidenceItemSchema = z
  .object({
    userId: z.string().min(1),
    repositoryId: z.string().min(1),
    skillId: z.string().min(1),
    evidenceType: z.enum(EVIDENCE_TYPES),
    signal: z.enum(SIGNAL_TYPES),
    value: z.union([z.string().min(1), z.number().finite()]),
    normalizedStrength: z.number().finite().min(0).max(1),
    sourcePath: z.string().min(1).optional(),
    sourceReference: z.string().min(1).optional(),
    explanation: z.string().min(1),
    detectedAt: z.date(),
    observationKey: z.string().min(1),
  })
  .refine((item) => EVIDENCE_TYPE_SIGNAL[item.evidenceType] === item.signal, {
    message: "signal does not match the evidence type",
    path: ["signal"],
  });

const KEY_SEPARATOR = "|";

// Deterministic identity of an evidence record within one (user, repository).
// It deliberately excludes timestamps, strengths and explanations, so
// re-running extraction over the same observations yields the same keys.
export function buildEvidenceKey(
  item: Pick<NewEvidenceItem, "skillId" | "evidenceType" | "sourcePath" | "observationKey">,
): string {
  return [item.skillId, item.evidenceType, item.sourcePath ?? "", item.observationKey].join(
    KEY_SEPARATOR,
  );
}
