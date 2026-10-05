import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { TechnologyConfig } from "../technology-config.js";
import type { DependencyObservation } from "../types.js";
import { resolveTechnologyId } from "./technology-match.js";
import type { ManifestParseResult } from "./package-json.js";

// fast-xml-parser does not resolve external entities or DTDs, so this stays
// static analysis only: no network access, no file access, no code execution
// can be triggered by a crafted pom.xml.
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

export function parsePomXml(
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  // fast-xml-parser's parse() is lenient about unclosed/mismatched tags, so
  // structural validity is checked explicitly rather than relying on parse()
  // to throw.
  const validation = XMLValidator.validate(content);

  if (validation !== true) {
    return {
      dependencies: [],
      warnings: [
        {
          code: "MALFORMED_MANIFEST",
          path: sourcePath,
          message: "pom.xml could not be parsed safely and was skipped.",
        },
      ],
    };
  }

  let document: Record<string, unknown>;

  try {
    document = parser.parse(content) as Record<string, unknown>;
  } catch {
    return {
      dependencies: [],
      warnings: [
        {
          code: "MALFORMED_MANIFEST",
          path: sourcePath,
          message: "pom.xml could not be parsed safely and was skipped.",
        },
      ],
    };
  }

  const project = document.project;

  if (!project || typeof project !== "object") {
    return {
      dependencies: [],
      warnings: [
        {
          code: "MALFORMED_MANIFEST",
          path: sourcePath,
          message: "pom.xml did not contain a recognizable <project> element.",
        },
      ],
    };
  }

  const dependenciesNode = (project as Record<string, unknown>).dependencies;
  const dependencyEntries = dependenciesNode
    ? asArray((dependenciesNode as Record<string, unknown>).dependency)
    : [];

  const dependencies: DependencyObservation[] = [];

  for (const entry of dependencyEntries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const groupId = textOf(record.groupId);
    const artifactId = textOf(record.artifactId);
    const version = textOf(record.version);
    const scope = textOf(record.scope);

    if (!artifactId) {
      continue;
    }

    const packageName = groupId ? `${groupId}:${artifactId}` : artifactId;

    dependencies.push({
      packageName,
      technology: resolveTechnologyId(config, "pom.xml", artifactId),
      source: "pom.xml",
      sourcePath,
      dependencyType: scope === "test" ? "dev" : scope === "provided" ? "optional" : "runtime",
      versionConstraint: version,
    });
  }

  dependencies.sort((a, b) => a.packageName.localeCompare(b.packageName));

  return { dependencies, warnings: [] };
}
