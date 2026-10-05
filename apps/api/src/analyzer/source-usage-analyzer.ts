import type { TechnologyConfig } from "./technology-config.js";
import type { SourceUsageObservation } from "./types.js";
import { displayNameFor } from "./dependency/technology-match.js";
import { countMatches } from "./import-matching.js";
import { extensionOf } from "./path-utils.js";

export interface SampledFile {
  path: string;
  content: string;
}

export interface SourceUsageInput {
  // The bounded set of files actually fetched and inspected for this
  // analysis run (shared across all technologies — one fetch can serve
  // several technologies' import detection at once).
  sampledFiles: SampledFile[];
  // Whether the candidate pool in the tree was larger than what the GitHub
  // request budget allowed us to sample, i.e. this is partial coverage.
  bounded: boolean;
}

export function analyzeSourceUsage(
  input: SourceUsageInput,
  relevantTechnologyIds: string[],
  config: TechnologyConfig,
): SourceUsageObservation[] {
  const observations: SourceUsageObservation[] = [];
  const sampledSourceFilePaths = [...input.sampledFiles.map((file) => file.path)].sort();

  for (const technologyId of [...relevantTechnologyIds].sort()) {
    const definition = config.technologies.find((item) => item.id === technologyId);

    if (!definition) {
      continue;
    }

    const applicableFiles =
      definition.sourceFileExtensions.length === 0
        ? input.sampledFiles
        : input.sampledFiles.filter((file) =>
            definition.sourceFileExtensions.includes(extensionOf(file.path)),
          );

    let importReferenceCount = 0;
    const relevantSourceFilePaths: string[] = [];

    for (const file of applicableFiles) {
      let fileMatchCount = 0;

      for (const pattern of definition.sourceImportPatterns) {
        fileMatchCount += countMatches(file.content, pattern);
      }

      if (fileMatchCount > 0) {
        importReferenceCount += fileMatchCount;
        relevantSourceFilePaths.push(file.path);
      }
    }

    relevantSourceFilePaths.sort();

    const importSignal = Math.min(importReferenceCount / 3, 1);
    const fileUsageSignal = Math.min(relevantSourceFilePaths.length / 10, 1);

    observations.push({
      technology: technologyId,
      displayName: displayNameFor(config, technologyId),
      importReferenceCount,
      relevantSourceFileCount: relevantSourceFilePaths.length,
      importSignal,
      fileUsageSignal,
      sourceUsage: 0.6 * importSignal + 0.4 * fileUsageSignal,
      relevantSourceFilePaths,
      sampledSourceFilePaths,
      bounded: input.bounded,
    });
  }

  return observations;
}
