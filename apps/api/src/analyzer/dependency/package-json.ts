import { safeParseJson } from "../file-safety.js";
import type { TechnologyConfig } from "../technology-config.js";
import type { AnalyzerWarning, DependencyObservation, DependencyType } from "../types.js";
import { resolveTechnologyId } from "./technology-match.js";

const SECTIONS: Array<{ key: string; dependencyType: DependencyType }> = [
  { key: "dependencies", dependencyType: "runtime" },
  { key: "devDependencies", dependencyType: "dev" },
  { key: "optionalDependencies", dependencyType: "optional" },
  { key: "peerDependencies", dependencyType: "peer" },
];

export interface ManifestParseResult {
  dependencies: DependencyObservation[];
  warnings: AnalyzerWarning[];
}

export function parsePackageJson(
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  const parsed = safeParseJson<Record<string, unknown>>(content);

  if (!parsed.ok) {
    return {
      dependencies: [],
      warnings: [
        {
          code: "MALFORMED_MANIFEST",
          path: sourcePath,
          message: "package.json could not be parsed safely and was skipped.",
        },
      ],
    };
  }

  const manifest = parsed.data;
  const dependencies: DependencyObservation[] = [];

  for (const section of SECTIONS) {
    const value = manifest[section.key];

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    for (const [packageName, versionConstraint] of Object.entries(
      value as Record<string, unknown>,
    )) {
      dependencies.push({
        packageName,
        technology: resolveTechnologyId(config, "package.json", packageName),
        source: "package.json",
        sourcePath,
        dependencyType: section.dependencyType,
        versionConstraint: typeof versionConstraint === "string" ? versionConstraint : null,
      });
    }
  }

  dependencies.sort((a, b) =>
    a.packageName === b.packageName
      ? a.dependencyType.localeCompare(b.dependencyType)
      : a.packageName.localeCompare(b.packageName),
  );

  return { dependencies, warnings: [] };
}
