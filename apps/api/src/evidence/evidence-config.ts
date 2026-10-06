import { readFileSync } from "node:fs";
import { parseSkillTaxonomy, SkillTaxonomyError, type SkillTaxonomy } from "@nexus/domain";
import { loadTechnologyConfig, type TechnologyConfig } from "../analyzer/technology-config.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export interface EvidenceConfig {
  taxonomy: SkillTaxonomy;
  technologies: TechnologyConfig;
}

// Resolved relative to this file so the loader is independent of the
// process's current working directory.
const SKILLS_CONFIG_PATH = new URL("../../../../config/skills.json", import.meta.url);

function invalidMapping(message: string): AppError {
  return new AppError(AuthErrorCode.INVALID_TECHNOLOGY_MAPPING, 500, message);
}

// Cross-validates every skill id referenced by the technology configuration
// against the taxonomy. A mapping to an unknown skill fails loudly here
// rather than silently producing evidence for a skill that does not exist.
export function validateEvidenceConfig(config: EvidenceConfig): void {
  const known = new Set(config.taxonomy.skills.map((skill) => skill.id));
  const check = (skillId: string, where: string): void => {
    if (!known.has(skillId)) {
      throw invalidMapping(`${where} references unknown skill "${skillId}".`);
    }
  };

  for (const technology of config.technologies.technologies) {
    for (const skillId of technology.skillIds) {
      check(skillId, `Technology "${technology.id}"`);
    }
  }

  for (const [language, skillId] of Object.entries(config.technologies.languageSkills)) {
    check(skillId, `Language "${language}"`);
  }

  const { docker, genericTesting, structure } = config.technologies.observationSkills;

  for (const skillId of docker) {
    check(skillId, "Docker mapping");
  }

  for (const skillId of genericTesting) {
    check(skillId, "Generic testing mapping");
  }

  for (const [category, skillIds] of Object.entries(structure)) {
    if (!(category in config.technologies.structureCategories)) {
      throw invalidMapping(`Structure mapping "${category}" is not a known structure category.`);
    }

    for (const skillId of skillIds) {
      check(skillId, `Structure category "${category}"`);
    }
  }
}

let cachedConfig: EvidenceConfig | null = null;

export function loadEvidenceConfig(): EvidenceConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  let taxonomy: SkillTaxonomy;

  try {
    taxonomy = parseSkillTaxonomy(JSON.parse(readFileSync(SKILLS_CONFIG_PATH, "utf-8")));
  } catch (error) {
    const message =
      error instanceof SkillTaxonomyError ? error.message : "config/skills.json could not be loaded.";
    throw new AppError(AuthErrorCode.INVALID_SKILL_CONFIGURATION, 500, message);
  }

  const config: EvidenceConfig = { taxonomy, technologies: loadTechnologyConfig() };
  validateEvidenceConfig(config);
  cachedConfig = config;

  return config;
}

export function resetEvidenceConfigCache(): void {
  cachedConfig = null;
}
