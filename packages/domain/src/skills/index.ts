import { z } from "zod";

// Pure skill-taxonomy domain model. The taxonomy data itself lives in
// config/skills.json; this module only defines its shape and validation, so
// it stays free of any filesystem, Express, or MongoDB dependency.

const SKILL_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const idSchema = z.string().regex(SKILL_ID_PATTERN, "ids must be lowercase kebab-case");

const skillSchema = z.object({
  id: idSchema,
  displayName: z.string().min(1),
});

const categorySchema = z.object({
  id: idSchema,
  displayName: z.string().min(1),
  skills: z.array(skillSchema).min(1),
});

export const skillTaxonomySchema = z.object({
  root: z.object({ id: idSchema, displayName: z.string().min(1) }),
  categories: z.array(categorySchema).min(1),
});

export interface Skill {
  id: string;
  displayName: string;
  categoryId: string;
}

export interface SkillCategory {
  id: string;
  displayName: string;
  skillIds: string[];
}

export interface SkillTaxonomy {
  root: { id: string; displayName: string };
  categories: SkillCategory[];
  skills: Skill[];
}

export class SkillTaxonomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillTaxonomyError";
  }
}

// Validates raw taxonomy data and flattens it. Duplicate ids (across skills,
// categories, or the root) are rejected so a skill id always identifies
// exactly one skill.
export function parseSkillTaxonomy(raw: unknown): SkillTaxonomy {
  const parsed = skillTaxonomySchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new SkillTaxonomyError(`Invalid skill taxonomy: ${details}`);
  }

  const seen = new Set<string>([parsed.data.root.id]);
  const skills: Skill[] = [];
  const categories: SkillCategory[] = [];

  for (const category of parsed.data.categories) {
    if (seen.has(category.id)) {
      throw new SkillTaxonomyError(`Invalid skill taxonomy: duplicate id "${category.id}".`);
    }
    seen.add(category.id);

    for (const skill of category.skills) {
      if (seen.has(skill.id)) {
        throw new SkillTaxonomyError(`Invalid skill taxonomy: duplicate id "${skill.id}".`);
      }
      seen.add(skill.id);
      skills.push({ id: skill.id, displayName: skill.displayName, categoryId: category.id });
    }

    categories.push({
      id: category.id,
      displayName: category.displayName,
      skillIds: category.skills.map((skill) => skill.id),
    });
  }

  return { root: parsed.data.root, categories, skills };
}

export function findSkill(taxonomy: SkillTaxonomy, skillId: string): Skill | undefined {
  return taxonomy.skills.find((skill) => skill.id === skillId);
}
