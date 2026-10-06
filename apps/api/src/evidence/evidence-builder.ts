import {
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_SIGNAL,
  buildEvidenceKey,
  evidenceItemSchema,
  findSkill,
  type EvidenceType,
  type EvidenceValue,
  type NewEvidenceItem,
} from "@nexus/domain";
import type { TechnologyDefinition } from "../analyzer/technology-config.js";
import type { RepositoryAnalysis } from "../analyzer/types.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { loadEvidenceConfig, type EvidenceConfig } from "./evidence-config.js";

// Phase 4 evidence extraction. A pure, deterministic function from a Phase 3
// RepositoryAnalysis to EvidenceItems. It performs no I/O, never re-fetches
// anything from GitHub, and calculates no skill score: `normalizedStrength`
// either reuses a signal Phase 3 already produced or states plain presence.

export interface BuildEvidenceInput {
  userId: string;
  repositoryId: string;
  analysis: RepositoryAnalysis;
  // Detection time stamped onto every item. It never takes part in identity.
  detectedAt: Date;
}

export interface BuildEvidenceResult {
  items: NewEvidenceItem[];
  // Technologies that were observed but have no canonical skill mapping.
  // They produce no evidence (no skill is ever invented for them).
  unmappedTechnologies: string[];
}

interface Draft {
  skillId: string;
  evidenceType: EvidenceType;
  value: EvidenceValue;
  normalizedStrength: number;
  sourcePath?: string;
  sourceReference?: string;
  explanation: string;
  observationKey: string;
}

const GENERIC_TEST_WEIGHT = 0.5;
const SKILL_TEST_WEIGHT = 0.5;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function dependencyKindLabel(type: string): string {
  switch (type) {
    case "runtime":
      return "a runtime dependency";
    case "dev":
      return "a dev dependency";
    case "optional":
      return "an optional dependency";
    case "peer":
      return "a peer dependency";
    default:
      return "a dependency";
  }
}

export function buildEvidence(
  input: BuildEvidenceInput,
  config: EvidenceConfig = loadEvidenceConfig(),
): BuildEvidenceResult {
  const { analysis } = input;
  const drafts: Draft[] = [];
  const unmapped = new Set<string>();

  const technologyById = new Map<string, TechnologyDefinition>(
    config.technologies.technologies.map((technology) => [technology.id, technology]),
  );

  const skillName = (skillId: string): string =>
    findSkill(config.taxonomy, skillId)?.displayName ?? skillId;

  // Resolves a technology id to its canonical skills. Unknown technologies and
  // technologies without a skill mapping resolve to nothing.
  const resolveTechnology = (technologyId: string) => {
    const definition = technologyById.get(technologyId);
    const skillIds = definition ? [...definition.skillIds].sort(compareStrings) : [];

    if (!definition || skillIds.length === 0) {
      unmapped.add(technologyId);
    }

    return { displayName: definition?.displayName ?? technologyId, skillIds };
  };

  const push = (draft: Draft): void => {
    if (!isFiniteNumber(draft.normalizedStrength)) {
      return; // malformed observation: no evidence rather than a bad value
    }

    if (!findSkill(config.taxonomy, draft.skillId)) {
      throw new AppError(
        AuthErrorCode.INVALID_TECHNOLOGY_MAPPING,
        500,
        `Mapping produced unknown skill "${draft.skillId}".`,
      );
    }

    drafts.push({ ...draft, normalizedStrength: clamp01(draft.normalizedStrength) });
  };

  // DEPENDENCY -------------------------------------------------------------
  for (const dependency of analysis.dependencies ?? []) {
    if (!dependency.technology) {
      continue;
    }

    const { displayName, skillIds } = resolveTechnology(dependency.technology);

    for (const skillId of skillIds) {
      push({
        skillId,
        evidenceType: "DEPENDENCY",
        value: dependency.packageName,
        normalizedStrength: 1,
        sourcePath: dependency.sourcePath,
        sourceReference: `${dependency.dependencyType}:${dependency.packageName}`,
        explanation: `${displayName} is declared as ${dependencyKindLabel(dependency.dependencyType)} in ${dependency.sourcePath}.`,
        observationKey: `dependency:${dependency.packageName}:${dependency.dependencyType}`,
      });
    }
  }

  // FRAMEWORK --------------------------------------------------------------
  const frameworkKindOrder = { dependency: 0, config: 1, source: 2 } as const;

  for (const framework of analysis.frameworks ?? []) {
    const { displayName, skillIds } = resolveTechnology(framework.technology);
    const detections = [...(framework.evidence ?? [])].sort(
      (a, b) =>
        frameworkKindOrder[a.type] - frameworkKindOrder[b.type] ||
        compareStrings(a.sourcePath, b.sourcePath),
    );

    if (detections.length === 0) {
      continue;
    }

    const reasons = Array.from(
      new Set(
        detections.map((item) => {
          switch (item.type) {
            case "dependency":
              return `a dependency declaration in ${item.sourcePath}`;
            case "config":
              return `the configuration file ${item.sourcePath}`;
            default:
              return `an import in ${item.sourcePath}`;
          }
        }),
      ),
    );

    for (const skillId of skillIds) {
      push({
        skillId,
        evidenceType: "FRAMEWORK",
        value: framework.technology,
        normalizedStrength: 1,
        sourcePath: detections[0]?.sourcePath,
        sourceReference: detections.map((item) => `${item.type}:${item.sourcePath}`).join("; "),
        explanation: `${displayName} was detected from ${reasons.join(", ")}.`,
        observationKey: `framework:${framework.technology}`,
      });
    }
  }

  // SOURCE_FILE ------------------------------------------------------------
  for (const usage of analysis.sourceUsage ?? []) {
    const { displayName, skillIds } = resolveTechnology(usage.technology);

    if (!isFiniteNumber(usage.sourceUsage) || usage.sourceUsage <= 0) {
      continue;
    }

    const paths = [...(usage.relevantSourceFilePaths ?? [])].sort(compareStrings);
    const location = paths[0] ? `in ${paths[0]}` : "in the sampled source files";
    const boundedNote = usage.bounded ? "; the inspected sample was bounded by the request budget" : "";

    for (const skillId of skillIds) {
      push({
        skillId,
        evidenceType: "SOURCE_FILE",
        value: usage.importReferenceCount,
        normalizedStrength: usage.sourceUsage,
        sourcePath: paths[0],
        sourceReference: paths.length > 1 ? paths.join(", ") : undefined,
        explanation: `${displayName} source usage was detected ${location} (${usage.importReferenceCount} import ${plural(usage.importReferenceCount, "reference")} across ${usage.relevantSourceFileCount} sampled source ${plural(usage.relevantSourceFileCount, "file")}${boundedNote}).`,
        observationKey: `source-usage:${usage.technology}`,
      });
    }
  }

  // LANGUAGE ---------------------------------------------------------------
  const languageSkills = new Map(
    Object.entries(config.technologies.languageSkills).map(([language, skillId]) => [
      language.toLowerCase(),
      skillId,
    ]),
  );
  const languages = analysis.languages;

  if (languages && isFiniteNumber(languages.totalBytes) && languages.totalBytes > 0) {
    for (const language of Object.keys(languages.bytesByLanguage ?? {}).sort(compareStrings)) {
      const bytes = languages.bytesByLanguage[language];
      const skillId = languageSkills.get(language.toLowerCase());

      if (!skillId || !isFiniteNumber(bytes) || bytes <= 0) {
        continue;
      }

      const percentage = languages.percentageByLanguage?.[language];
      const share = isFiniteNumber(percentage) ? percentage : (bytes / languages.totalBytes) * 100;

      push({
        skillId,
        evidenceType: "LANGUAGE",
        value: share,
        normalizedStrength: bytes / languages.totalBytes,
        sourceReference: "github:languages",
        explanation: `${language} makes up ${share}% of the repository's code bytes according to GitHub language statistics.`,
        observationKey: `language:${language}`,
      });
    }
  }

  // PROJECT_STRUCTURE ------------------------------------------------------
  for (const structure of analysis.projectStructure ?? []) {
    const skillIds = config.technologies.observationSkills.structure[structure.category] ?? [];
    const patternCount = config.technologies.structureCategories[structure.category]?.length ?? 0;

    if (structure.relevantStructureSignalCount <= 0 || patternCount === 0) {
      continue;
    }

    const paths = [...structure.detectedPaths].sort(compareStrings);

    for (const skillId of [...skillIds].sort(compareStrings)) {
      push({
        skillId,
        evidenceType: "PROJECT_STRUCTURE",
        value: structure.relevantStructureSignalCount,
        normalizedStrength: structure.relevantStructureSignalCount / patternCount,
        sourcePath: paths[0],
        sourceReference: paths.length > 1 ? paths.join(", ") : undefined,
        explanation: `Directory layout matching ${structure.category} conventions was detected: ${paths.join(", ")}.`,
        observationKey: `structure:${structure.category}`,
      });
    }
  }

  // DOCKER -----------------------------------------------------------------
  const docker = analysis.docker;

  if (docker) {
    const dockerSkills = [...config.technologies.observationSkills.docker].sort(compareStrings);
    const artifacts: Array<{ path: string; kind: "dockerfile" | "compose" }> = [
      ...(docker.dockerfilePaths ?? []).map((path) => ({ path, kind: "dockerfile" as const })),
      ...(docker.composePaths ?? []).map((path) => ({ path, kind: "compose" as const })),
    ];

    for (const artifact of artifacts) {
      const label = artifact.kind === "dockerfile" ? "Dockerfile" : "Docker Compose file";
      const explanation = artifact.path.includes("/")
        ? `${label} is present at ${artifact.path}.`
        : `${artifact.path} is present at the repository root.`;

      for (const skillId of dockerSkills) {
        push({
          skillId,
          evidenceType: "DOCKER",
          value: artifact.kind,
          normalizedStrength: 1,
          sourcePath: artifact.path,
          explanation,
          observationKey: `docker:${artifact.kind}`,
        });
      }
    }
  }

  // TEST -------------------------------------------------------------------
  const testing = analysis.testing;

  if (testing && isFiniteNumber(testing.genericTestSignal)) {
    const testPaths = [...(testing.testFilePaths ?? [])].sort(compareStrings);

    if (testing.testFileCount > 0) {
      for (const skillId of [...config.technologies.observationSkills.genericTesting].sort(compareStrings)) {
        push({
          skillId,
          evidenceType: "TEST",
          value: testing.testFileCount,
          normalizedStrength: testing.genericTestSignal,
          sourcePath: testPaths[0],
          sourceReference: `repository-tree:test-files(${testing.testFileCount}/${testing.sourceFileCount})`,
          explanation: `${testing.testFileCount} test ${plural(testing.testFileCount, "file")} detected among ${testing.sourceFileCount} source ${plural(testing.sourceFileCount, "file")} by test/spec naming and test-directory conventions.`,
          observationKey: "test:generic",
        });
      }
    }

    for (const perTechnology of testing.perTechnology ?? []) {
      const { displayName, skillIds } = resolveTechnology(perTechnology.technology);

      if (perTechnology.skillReferencedTestFiles <= 0) {
        continue;
      }

      const combined =
        GENERIC_TEST_WEIGHT * testing.genericTestSignal +
        SKILL_TEST_WEIGHT * perTechnology.skillSpecificTestSignal;

      for (const skillId of skillIds) {
        push({
          skillId,
          evidenceType: "TEST",
          value: perTechnology.skillReferencedTestFiles,
          normalizedStrength: combined,
          sourceReference: `repository-tree:test-files(${perTechnology.skillReferencedTestFiles}/${testing.testFileCount})`,
          explanation: `${perTechnology.skillReferencedTestFiles} of ${testing.testFileCount} test ${plural(testing.testFileCount, "file")} relate to ${displayName} (matched by file type or path).`,
          observationKey: `test:${perTechnology.technology}`,
        });
      }
    }
  }

  // README -----------------------------------------------------------------
  const documentation = analysis.documentation;

  if (documentation?.readmePresent && documentation.readmePath) {
    for (const perTechnology of documentation.perTechnology ?? []) {
      if (!perTechnology.skillMention) {
        continue;
      }

      const { displayName, skillIds } = resolveTechnology(perTechnology.technology);

      for (const skillId of skillIds) {
        push({
          skillId,
          evidenceType: "README",
          value: perTechnology.technology,
          normalizedStrength: perTechnology.documentationSignal,
          sourcePath: documentation.readmePath,
          explanation: `${documentation.readmePath} contains an observable reference to ${displayName}.`,
          observationKey: `readme:${perTechnology.technology}`,
        });
      }
    }
  }

  // COMMIT_ACTIVITY --------------------------------------------------------
  // Repository activity is not specific to one skill, but every evidence item
  // belongs to exactly one skill, so the observation is attached to each skill
  // that already has evidence in this repository.
  const activity = analysis.activity;

  if (activity && isFiniteNumber(activity.activity) && activity.recentCommitCount > 0) {
    const supportedSkills = Array.from(new Set(drafts.map((draft) => draft.skillId))).sort(
      compareStrings,
    );

    for (const skillId of supportedSkills) {
      push({
        skillId,
        evidenceType: "COMMIT_ACTIVITY",
        value: activity.recentCommitCount,
        normalizedStrength: activity.activity,
        sourceReference: `github:commits:last-${activity.windowDays}-days`,
        explanation: `${activity.recentCommitCount} ${plural(activity.recentCommitCount, "commit")} on ${activity.activeDays} active ${plural(activity.activeDays, "day")} observed in the last ${activity.windowDays} days, in a repository with ${skillName(skillId)} evidence.`,
        observationKey: `activity:${activity.windowDays}d`,
      });
    }
  }

  // Deterministic order + identity-based deduplication ---------------------
  const typeOrder = new Map(EVIDENCE_TYPES.map((type, index) => [type, index]));

  drafts.sort(
    (a, b) =>
      compareStrings(a.skillId, b.skillId) ||
      (typeOrder.get(a.evidenceType) ?? 0) - (typeOrder.get(b.evidenceType) ?? 0) ||
      compareStrings(a.sourcePath ?? "", b.sourcePath ?? "") ||
      compareStrings(a.observationKey, b.observationKey) ||
      compareStrings(a.sourceReference ?? "", b.sourceReference ?? ""),
  );

  const byKey = new Map<string, NewEvidenceItem>();

  for (const draft of drafts) {
    const key = buildEvidenceKey(draft);

    if (byKey.has(key)) {
      continue;
    }

    const item: NewEvidenceItem = {
      userId: input.userId,
      repositoryId: input.repositoryId,
      skillId: draft.skillId,
      evidenceType: draft.evidenceType,
      signal: EVIDENCE_TYPE_SIGNAL[draft.evidenceType],
      value: draft.value,
      normalizedStrength: draft.normalizedStrength,
      ...(draft.sourcePath ? { sourcePath: draft.sourcePath } : {}),
      ...(draft.sourceReference ? { sourceReference: draft.sourceReference } : {}),
      explanation: draft.explanation,
      detectedAt: input.detectedAt,
      observationKey: draft.observationKey,
    };

    if (!evidenceItemSchema.safeParse(item).success) {
      throw new AppError(
        AuthErrorCode.INVALID_EVIDENCE,
        500,
        `Generated ${draft.evidenceType} evidence for skill "${draft.skillId}" failed validation.`,
      );
    }

    byKey.set(key, item);
  }

  return {
    items: Array.from(byKey.values()),
    unmappedTechnologies: Array.from(unmapped).sort(compareStrings),
  };
}
