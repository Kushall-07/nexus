import type { AnalyzerWarning, LanguageObservations } from "./types.js";

// Normalizes GitHub's raw language byte counts into deterministic
// percentages. This is an evidence signal only — a percentage is never
// converted into a score here or anywhere in Phase 3.
export function analyzeLanguages(
  rawLanguages: Record<string, number> | null | undefined,
): { observations: LanguageObservations; warnings: AnalyzerWarning[] } {
  const warnings: AnalyzerWarning[] = [];

  if (!rawLanguages || Object.keys(rawLanguages).length === 0) {
    warnings.push({
      code: "NO_LANGUAGE_DATA",
      message: "GitHub returned no language statistics for this repository.",
    });

    return {
      observations: { bytesByLanguage: {}, percentageByLanguage: {}, totalBytes: 0 },
      warnings,
    };
  }

  const bytesByLanguage: Record<string, number> = {};
  let totalBytes = 0;

  for (const [language, bytes] of Object.entries(rawLanguages)) {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
      continue;
    }

    bytesByLanguage[language] = bytes;
    totalBytes += bytes;
  }

  if (totalBytes === 0) {
    warnings.push({
      code: "NO_LANGUAGE_DATA",
      message: "GitHub language statistics totaled zero bytes.",
    });

    return {
      observations: { bytesByLanguage, percentageByLanguage: {}, totalBytes: 0 },
      warnings,
    };
  }

  const percentageByLanguage: Record<string, number> = {};

  for (const [language, bytes] of Object.entries(bytesByLanguage)) {
    percentageByLanguage[language] = Math.round((bytes / totalBytes) * 10000) / 100;
  }

  return {
    observations: { bytesByLanguage, percentageByLanguage, totalBytes },
    warnings,
  };
}
