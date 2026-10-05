import type { TechnologyConfig } from "./technology-config.js";
import { displayNameFor } from "./dependency/technology-match.js";
import { findFirstMatchedLine } from "./import-matching.js";
import { basename } from "./path-utils.js";
import type {
  DependencyObservation,
  FrameworkEvidenceItem,
  FrameworkObservation,
  RepositoryTree,
} from "./types.js";
import type { SampledFile } from "./source-usage-analyzer.js";

export interface FrameworkDetectionInput {
  dependencies: DependencyObservation[];
  tree: RepositoryTree;
  sampledFiles: SampledFile[];
}

// A framework is only reported when at least one concrete, observable piece
// of evidence exists for it. Language presence alone is never sufficient —
// there is deliberately no "language implies framework" branch anywhere here.
export function detectFrameworks(
  input: FrameworkDetectionInput,
  config: TechnologyConfig,
): FrameworkObservation[] {
  const observations: FrameworkObservation[] = [];

  const frameworkDefinitions = config.technologies.filter(
    (technology) => technology.category === "framework",
  );

  for (const definition of frameworkDefinitions) {
    const evidence: FrameworkEvidenceItem[] = [];

    for (const dependency of input.dependencies) {
      if (dependency.technology === definition.id) {
        evidence.push({
          type: "dependency",
          sourcePath: dependency.sourcePath,
          sourceReference: `${dependency.dependencyType}:${dependency.packageName}`,
        });
      }
    }

    if (definition.configFilePatterns.length > 0) {
      for (const entry of input.tree.entries) {
        if (entry.type !== "blob") {
          continue;
        }

        if (definition.configFilePatterns.includes(basename(entry.path))) {
          evidence.push({
            type: "config",
            sourcePath: entry.path,
            sourceReference: basename(entry.path),
          });
        }
      }
    }

    for (const file of input.sampledFiles) {
      const matchedLine = findFirstMatchedLine(file.content, definition.sourceImportPatterns);

      if (matchedLine) {
        evidence.push({
          type: "source",
          sourcePath: file.path,
          sourceReference: matchedLine,
        });
      }
    }

    if (evidence.length > 0) {
      observations.push({
        technology: definition.id,
        displayName: displayNameFor(config, definition.id),
        evidence,
      });
    }
  }

  observations.sort((a, b) => a.technology.localeCompare(b.technology));

  return observations;
}
