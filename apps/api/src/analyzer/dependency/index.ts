import type { TechnologyConfig } from "../technology-config.js";
import type { SupportedManifest } from "../types.js";
import { parsePackageJson, type ManifestParseResult } from "./package-json.js";
import { parseRequirementsTxt } from "./requirements-txt.js";
import { parsePyprojectToml } from "./pyproject-toml.js";
import { parseGoMod } from "./go-mod.js";
import { parsePomXml } from "./pom-xml.js";

export type { ManifestParseResult } from "./package-json.js";

const PARSERS: Record<
  SupportedManifest,
  (content: string, sourcePath: string, config: TechnologyConfig) => ManifestParseResult
> = {
  "package.json": parsePackageJson,
  "requirements.txt": parseRequirementsTxt,
  "pyproject.toml": parsePyprojectToml,
  "go.mod": parseGoMod,
  "pom.xml": parsePomXml,
};

export function parseManifest(
  manifest: SupportedManifest,
  content: string,
  sourcePath: string,
  config: TechnologyConfig,
): ManifestParseResult {
  return PARSERS[manifest](content, sourcePath, config);
}
