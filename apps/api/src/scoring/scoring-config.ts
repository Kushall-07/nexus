import { readFileSync } from "node:fs";
import { ScoringConfigError, parseScoringConfig, type ScoringConfig } from "@nexus/domain";
import { loadEvidenceConfig } from "../evidence/evidence-config.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

// Resolved relative to this file so the loader is independent of the
// process's current working directory.
const SCORING_CONFIG_PATH = new URL("../../../../config/scoring.json", import.meta.url);

let cachedConfig: ScoringConfig | null = null;

// Loads and strictly validates config/scoring.json against the skill taxonomy.
// Invalid configuration fails loudly; it is never repaired.
export function loadScoringConfig(): ScoringConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const { taxonomy } = loadEvidenceConfig();

  try {
    cachedConfig = parseScoringConfig(
      JSON.parse(readFileSync(SCORING_CONFIG_PATH, "utf-8")),
      taxonomy.skills.map((skill) => skill.id),
    );
  } catch (error) {
    const message =
      error instanceof ScoringConfigError ? error.message : "config/scoring.json could not be loaded.";
    throw new AppError(AuthErrorCode.INVALID_SCORING_CONFIGURATION, 500, message);
  }

  return cachedConfig;
}

export function resetScoringConfigCache(): void {
  cachedConfig = null;
}
