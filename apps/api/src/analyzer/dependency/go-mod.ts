import type { TechnologyConfig } from "../technology-config.js";
import type { DependencyObservation } from "../types.js";
import { resolveTechnologyId } from "./technology-match.js";
import type { ManifestParseResult } from "./package-json.js";

// Matches a single require entry, with or without a trailing "// indirect"
// comment: `github.com/example/pkg v1.2.3` or `github.com/example/pkg v1.2.3 // indirect`.
const REQUIRE_ENTRY_PATTERN = /^(\S+)\s+(v\S+)(\s*\/\/\s*indirect)?/;

function parseEntry(
  rawLine: string,
  sourcePath: string,
  config: TechnologyConfig,
): DependencyObservation | null {
  const line = rawLine.trim();

  if (line.length === 0 || line.startsWith("//")) {
    return null;
  }

  const match = REQUIRE_ENTRY_PATTERN.exec(line);

  if (!match) {
    return null;
  }

  const modulePath = match[1];
  const version = match[2];
  const isIndirect = Boolean(match[3]);

  return {
    packageName: modulePath,
    technology: resolveTechnologyId(config, "go.mod", modulePath),
    source: "go.mod",
    sourcePath,
    dependencyType: isIndirect ? "unknown" : "runtime",
    versionConstraint: version,
  };
}

export function parseGoMod(
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  const dependencies: DependencyObservation[] = [];
  const lines = content.split(/\r?\n/);
  let insideRequireBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!insideRequireBlock) {
      if (/^require\s*\(/.test(trimmed)) {
        insideRequireBlock = true;
        continue;
      }

      const singleRequireMatch = /^require\s+(.+)$/.exec(trimmed);
      if (singleRequireMatch) {
        const entry = parseEntry(singleRequireMatch[1], sourcePath, config);
        if (entry) {
          dependencies.push(entry);
        }
      }

      continue;
    }

    if (trimmed === ")") {
      insideRequireBlock = false;
      continue;
    }

    const entry = parseEntry(trimmed, sourcePath, config);
    if (entry) {
      dependencies.push(entry);
    }
  }

  const seen = new Set<string>();
  const deduplicated = dependencies.filter((dep) => {
    const key = dep.packageName.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  deduplicated.sort((a, b) => a.packageName.localeCompare(b.packageName));

  return { dependencies: deduplicated, warnings: [] };
}
