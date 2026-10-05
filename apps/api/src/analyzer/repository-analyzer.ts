import { RequestBudget } from "../services/request-budget.js";
import { analyzeActivity } from "./activity-analyzer.js";
import { analyzeDocker } from "./docker-analyzer.js";
import { analyzeDocumentation } from "./documentation-analyzer.js";
import { parseManifest } from "./dependency/index.js";
import { detectFrameworks } from "./framework-detector.js";
import { analyzeLanguages } from "./language-analyzer.js";
import { basename } from "./path-utils.js";
import {
  fetchRepositorySnapshot,
  type NamedFile,
  type RepositoryContext,
} from "./repository-fetcher.js";
import { analyzeSourceUsage, type SampledFile } from "./source-usage-analyzer.js";
import { analyzeStructure } from "./structure-analyzer.js";
import { analyzeTests } from "./test-analyzer.js";
import { loadTechnologyConfig, type TechnologyConfig } from "./technology-config.js";
import type {
  AnalyzerWarning,
  DependencyObservation,
  FetchedFile,
  RepositoryAnalysis,
} from "./types.js";

const UNSUPPORTED_MANIFEST_NAMES = ["Cargo.toml", "Gemfile", "composer.json", "build.gradle"];

function warningForSkippedFile(
  file: FetchedFile,
  context: "manifest" | "config" | "readme" | "source",
): AnalyzerWarning | null {
  switch (file.status) {
    case "decoded":
      return null;
    case "skipped_too_large":
      return {
        code: "FILE_TOO_LARGE",
        path: file.path,
        message: `${file.path} exceeded the analyzer size limit and was skipped.`,
      };
    case "skipped_binary":
      return {
        code: "BINARY_FILE_SKIPPED",
        path: file.path,
        message: `${file.path} was detected as binary and was not parsed as text.`,
      };
    case "skipped_not_found":
      return {
        code: "FILE_NOT_FOUND",
        path: file.path,
        message: `${file.path} could not be retrieved from GitHub.`,
      };
    case "skipped_budget":
      return {
        code: "BUDGET_EXHAUSTED",
        path: file.path,
        message: `${file.path} was not fetched because the GitHub request budget was exhausted.`,
      };
    case "skipped_malformed":
      return {
        code: context === "manifest" ? "MALFORMED_MANIFEST" : "FILE_NOT_FOUND",
        path: file.path,
        message: `${file.path} could not be decoded safely and was skipped.`,
      };
    default:
      return null;
  }
}

function toSampledFile(named: NamedFile): SampledFile | null {
  if (named.file.status !== "decoded" || named.file.content === null) {
    return null;
  }
  return { path: named.path, content: named.file.content };
}

function computeRelevantTechnologyIds(
  dependencies: DependencyObservation[],
  configFilePaths: string[],
  config: TechnologyConfig,
): string[] {
  const relevant = new Set<string>();

  for (const dependency of dependencies) {
    if (dependency.technology) {
      relevant.add(dependency.technology);
    }
  }

  const configBasenames = new Set(configFilePaths.map((path) => basename(path).toLowerCase()));

  for (const technology of config.technologies) {
    if (technology.configFilePatterns.some((pattern) => configBasenames.has(pattern.toLowerCase()))) {
      relevant.add(technology.id);
    }
  }

  return Array.from(relevant).sort();
}

function detectUnsupportedManifests(tree: { entries: { path: string; type: string }[] }): AnalyzerWarning[] {
  const warnings: AnalyzerWarning[] = [];
  const lowerNames = new Set(UNSUPPORTED_MANIFEST_NAMES.map((name) => name.toLowerCase()));

  for (const entry of tree.entries) {
    if (entry.type !== "blob") {
      continue;
    }

    if (lowerNames.has(basename(entry.path).toLowerCase())) {
      warnings.push({
        code: "UNSUPPORTED_MANIFEST",
        path: entry.path,
        message: `${entry.path} is not a manifest type supported by Phase 3 and was not parsed.`,
      });
    }
  }

  return warnings;
}

export interface AnalyzeRepositoryInput {
  accessToken: string;
  repositoryId: string;
  context: RepositoryContext;
  cachedLanguages: Record<string, number> | null;
  requestBudgetLimit: number;
}

export async function analyzeRepository(
  input: AnalyzeRepositoryInput,
): Promise<RepositoryAnalysis> {
  const config = loadTechnologyConfig();
  const budget = new RequestBudget(input.requestBudgetLimit);

  const snapshot = await fetchRepositorySnapshot(
    input.accessToken,
    input.context,
    input.cachedLanguages,
    config,
    budget,
  );

  const warnings: AnalyzerWarning[] = [...snapshot.warnings];
  warnings.push(...detectUnsupportedManifests(snapshot.tree));

  const { observations: languages, warnings: languageWarnings } = analyzeLanguages(
    snapshot.languages,
  );
  warnings.push(...languageWarnings);

  const dependencies: DependencyObservation[] = [];

  for (const manifestFile of snapshot.manifestFiles) {
    const skipWarning = warningForSkippedFile(manifestFile.file, "manifest");

    if (skipWarning) {
      warnings.push(skipWarning);
      continue;
    }

    if (manifestFile.file.content === null) {
      continue;
    }

    const parsed = parseManifest(
      manifestFile.manifest,
      manifestFile.file.content,
      manifestFile.path,
      config,
    );
    dependencies.push(...parsed.dependencies);
    warnings.push(...parsed.warnings);
  }

  for (const configFile of snapshot.configFiles) {
    const skipWarning = warningForSkippedFile(configFile.file, "config");
    if (skipWarning) {
      warnings.push(skipWarning);
    }
  }

  if (snapshot.readme) {
    const skipWarning = warningForSkippedFile(snapshot.readme.file, "readme");
    if (skipWarning) {
      warnings.push(skipWarning);
    }
  }

  for (const sourceFile of snapshot.sampledSourceFiles) {
    const skipWarning = warningForSkippedFile(sourceFile.file, "source");
    if (skipWarning) {
      warnings.push(skipWarning);
    }
  }

  const relevantTechnologyIds = computeRelevantTechnologyIds(
    dependencies,
    snapshot.configFiles.map((entry) => entry.path),
    config,
  );

  const sampledFiles: SampledFile[] = snapshot.sampledSourceFiles
    .map(toSampledFile)
    .filter((file): file is SampledFile => file !== null);

  const frameworks = detectFrameworks(
    { dependencies, tree: snapshot.tree, sampledFiles },
    config,
  );

  // Frameworks detected purely from config/source evidence (no matching
  // dependency entry) still deserve source-usage / test / documentation
  // signals, so fold them into the relevant-technology set too.
  for (const framework of frameworks) {
    relevantTechnologyIds.push(framework.technology);
  }
  const dedupedRelevantTechnologyIds = Array.from(new Set(relevantTechnologyIds)).sort();

  const sourceUsage = analyzeSourceUsage(
    {
      sampledFiles,
      bounded: snapshot.sourceCandidatePoolSize > snapshot.sampledSourceFiles.length,
    },
    dedupedRelevantTechnologyIds,
    config,
  );

  const projectStructure = analyzeStructure(snapshot.tree, config);
  const docker = analyzeDocker(snapshot.tree);
  const testing = analyzeTests(snapshot.tree, dedupedRelevantTechnologyIds, config);

  const readmeContent =
    snapshot.readme?.file.status === "decoded" ? snapshot.readme.file.content : null;

  const documentation = analyzeDocumentation(
    {
      path: snapshot.readme?.path ?? null,
      size: snapshot.readme?.file.size ?? null,
      content: readmeContent,
    },
    dedupedRelevantTechnologyIds,
    config,
  );

  const activity = analyzeActivity(snapshot.commits);

  return {
    repositoryId: input.repositoryId,
    repositoryFullName: `${input.context.owner}/${input.context.name}`,
    analyzedAt: new Date().toISOString(),
    languages,
    dependencies,
    frameworks,
    sourceUsage,
    projectStructure,
    docker,
    testing,
    documentation,
    activity,
    requestBudget: { limit: budget.limit, used: budget.used, remaining: budget.remaining },
    warnings,
  };
}
