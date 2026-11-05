import { loadMatchingConfig } from "./matching/matching-config.js";

// Maps free text onto the canonical NEXUS skill ids using the controlled alias
// table in config/job-matching.json. Text that matches no alias is never
// promoted to a skill id.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const patternCache = new Map<string, RegExp>();

function aliasPattern(alias: string): RegExp {
  let pattern = patternCache.get(alias);
  if (!pattern) {
    // "java" must not match inside "javascript"; "c++"/"node.js" keep their punctuation.
    pattern = new RegExp(`(?<![a-z0-9+#.])${escapeRegExp(alias)}(?![a-z0-9+#])`, "i");
    patternCache.set(alias, pattern);
  }
  return pattern;
}

export function normalizeSkillText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Exact (whole-string) alias lookup, e.g. a provider tag or a resume skill token.
export function canonicalSkillId(value: string, options: { allowTagOnly?: boolean } = {}): string | null {
  const config = loadMatchingConfig();
  const text = normalizeSkillText(value);

  for (const [skillId, aliases] of Object.entries(config.skillAliases)) {
    if (skillId === text || aliases.includes(text)) return skillId;
  }
  if (options.allowTagOnly) {
    for (const [skillId, aliases] of Object.entries(config.tagOnlyAliases)) {
      if (aliases.includes(text)) return skillId;
    }
  }
  return null;
}

// All canonical skills mentioned anywhere in free text, in alias-table order.
export function findSkillIdsInText(text: string): string[] {
  const config = loadMatchingConfig();
  const found: string[] = [];

  for (const [skillId, aliases] of Object.entries(config.skillAliases)) {
    if (aliases.some((alias) => aliasPattern(alias).test(text))) found.push(skillId);
  }
  return found;
}

// Normalizes a user/resume/job skill string: canonical id when recognised,
// otherwise the lowercase text itself.
export function toSkillKey(value: string, options: { allowTagOnly?: boolean } = {}): string {
  return canonicalSkillId(value, options) ?? normalizeSkillText(value);
}

export function resolveDirection(text: string): string | null {
  const config = loadMatchingConfig();
  const lowered = normalizeSkillText(text);

  for (const [directionId, aliases] of Object.entries(config.directionAliases)) {
    if (directionId === lowered || aliases.some((alias) => aliasPattern(alias).test(lowered))) {
      return directionId;
    }
  }
  return null;
}
