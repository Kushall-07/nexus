import type { TechnologyConfig } from "../technology-config.js";
import type { DependencyObservation } from "../types.js";
import { resolveTechnologyId } from "./technology-match.js";
import type { ManifestParseResult } from "./package-json.js";

// Matches a package name (PEP 508 style, extras allowed) at the start of a
// requirement line, followed by an optional version specifier.
const REQUIREMENT_LINE_PATTERN =
  /^([A-Za-z0-9][A-Za-z0-9._-]*)(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<)?\s*([^;#\s]*)/;

export interface ParsedPep508 {
  packageName: string;
  versionConstraint: string | null;
}

// Shared with the pyproject.toml parser, whose [project.dependencies] array
// entries are PEP 508 strings identical in shape to requirements.txt lines.
export function parsePep508Line(line: string): ParsedPep508 | null {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("-")) {
    return null;
  }

  const match = REQUIREMENT_LINE_PATTERN.exec(trimmed);

  if (!match) {
    return null;
  }

  const operator = match[3] ?? null;
  const version = match[4] && match[4].length > 0 ? match[4] : null;

  return {
    packageName: match[1],
    versionConstraint: operator && version ? `${operator}${version}` : null,
  };
}

export function parseRequirementsTxt(
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  const dependencies: DependencyObservation[] = [];
  const seen = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const parsed = parsePep508Line(rawLine);

    if (!parsed) {
      continue;
    }

    const key = parsed.packageName.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    dependencies.push({
      packageName: parsed.packageName,
      technology: resolveTechnologyId(config, "requirements.txt", parsed.packageName),
      source: "requirements.txt",
      sourcePath,
      dependencyType: "runtime",
      versionConstraint: parsed.versionConstraint,
    });
  }

  dependencies.sort((a, b) => a.packageName.localeCompare(b.packageName));

  return { dependencies, warnings: [] };
}
