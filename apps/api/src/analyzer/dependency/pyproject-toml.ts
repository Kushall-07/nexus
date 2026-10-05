import { parse as parseToml } from "smol-toml";
import type { TechnologyConfig } from "../technology-config.js";
import type { DependencyObservation } from "../types.js";
import { resolveTechnologyId } from "./technology-match.js";
import { parsePep508Line } from "./requirements-txt.js";
import type { ManifestParseResult } from "./package-json.js";

function pushPep508Entries(
  entries: unknown,
  sourcePath: string,
  config: TechnologyConfig,
  dependencyType: DependencyObservation["dependencyType"],
  out: DependencyObservation[],
): void {
  if (!Array.isArray(entries)) {
    return;
  }

  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }

    const parsed = parsePep508Line(entry);

    if (!parsed) {
      continue;
    }

    out.push({
      packageName: parsed.packageName,
      technology: resolveTechnologyId(config, "pyproject.toml", parsed.packageName),
      source: "pyproject.toml",
      sourcePath,
      dependencyType,
      versionConstraint: parsed.versionConstraint,
    });
  }
}

// Legacy Poetry-style tables: { "fastapi": "^0.1", "torch": { version = "^2.0" } }
function pushTableEntries(
  table: unknown,
  sourcePath: string,
  config: TechnologyConfig,
  dependencyType: DependencyObservation["dependencyType"],
  out: DependencyObservation[],
): void {
  if (!table || typeof table !== "object" || Array.isArray(table)) {
    return;
  }

  for (const [packageName, value] of Object.entries(table as Record<string, unknown>)) {
    if (packageName.toLowerCase() === "python") {
      continue;
    }

    let versionConstraint: string | null = null;

    if (typeof value === "string") {
      versionConstraint = value;
    } else if (value && typeof value === "object" && "version" in value) {
      const version = (value as Record<string, unknown>).version;
      versionConstraint = typeof version === "string" ? version : null;
    }

    out.push({
      packageName,
      technology: resolveTechnologyId(config, "pyproject.toml", packageName),
      source: "pyproject.toml",
      sourcePath,
      dependencyType,
      versionConstraint,
    });
  }
}

export function parsePyprojectToml(
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  let document: Record<string, unknown>;

  try {
    document = parseToml(content) as Record<string, unknown>;
  } catch {
    return {
      dependencies: [],
      warnings: [
        {
          code: "MALFORMED_MANIFEST",
          path: sourcePath,
          message: "pyproject.toml could not be parsed safely and was skipped.",
        },
      ],
    };
  }

  const dependencies: DependencyObservation[] = [];

  const project = document.project;
  if (project && typeof project === "object") {
    const projectTable = project as Record<string, unknown>;
    pushPep508Entries(projectTable.dependencies, sourcePath, config, "runtime", dependencies);

    const optionalDependencies = projectTable["optional-dependencies"];
    if (optionalDependencies && typeof optionalDependencies === "object") {
      for (const group of Object.values(optionalDependencies as Record<string, unknown>)) {
        pushPep508Entries(group, sourcePath, config, "optional", dependencies);
      }
    }
  }

  const dependencyGroups = document["dependency-groups"];
  if (dependencyGroups && typeof dependencyGroups === "object") {
    for (const group of Object.values(dependencyGroups as Record<string, unknown>)) {
      pushPep508Entries(group, sourcePath, config, "dev", dependencies);
    }
  }

  const tool = document.tool;
  if (tool && typeof tool === "object") {
    const poetry = (tool as Record<string, unknown>).poetry;
    if (poetry && typeof poetry === "object") {
      const poetryTable = poetry as Record<string, unknown>;
      pushTableEntries(poetryTable.dependencies, sourcePath, config, "runtime", dependencies);

      const poetryGroup = poetryTable.group;
      if (poetryGroup && typeof poetryGroup === "object") {
        for (const groupValue of Object.values(poetryGroup as Record<string, unknown>)) {
          if (groupValue && typeof groupValue === "object") {
            pushTableEntries(
              (groupValue as Record<string, unknown>).dependencies,
              sourcePath,
              config,
              "dev",
              dependencies,
            );
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  const deduplicated = dependencies.filter((dep) => {
    const key = `${dep.packageName.toLowerCase()}:${dep.dependencyType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  deduplicated.sort((a, b) => a.packageName.localeCompare(b.packageName));

  return { dependencies: deduplicated, warnings: [] };
}
