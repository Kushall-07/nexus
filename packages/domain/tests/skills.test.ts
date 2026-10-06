import { describe, expect, it } from "vitest";
import { SkillTaxonomyError, findSkill, parseSkillTaxonomy } from "../src/index.js";

const valid = {
  root: { id: "software-engineering", displayName: "Software Engineering" },
  categories: [
    {
      id: "frontend",
      displayName: "Frontend",
      skills: [
        { id: "react", displayName: "React" },
        { id: "ui-development", displayName: "UI Development" },
      ],
    },
    { id: "devops", displayName: "DevOps", skills: [{ id: "ci-cd", displayName: "CI/CD" }] },
  ],
};

describe("skill taxonomy", () => {
  it("flattens skills with their category", () => {
    const taxonomy = parseSkillTaxonomy(valid);

    expect(taxonomy.skills.map((skill) => skill.id)).toEqual(["react", "ui-development", "ci-cd"]);
    expect(findSkill(taxonomy, "react")?.categoryId).toBe("frontend");
    expect(taxonomy.categories[0]?.skillIds).toEqual(["react", "ui-development"]);
    expect(findSkill(taxonomy, "cobol")).toBeUndefined();
  });

  it("rejects duplicate ids across skills, categories and the root", () => {
    const duplicateSkill = structuredClone(valid);
    duplicateSkill.categories[1]!.skills[0]!.id = "react";
    expect(() => parseSkillTaxonomy(duplicateSkill)).toThrowError(SkillTaxonomyError);

    const skillClashesCategory = structuredClone(valid);
    skillClashesCategory.categories[1]!.skills[0]!.id = "frontend";
    expect(() => parseSkillTaxonomy(skillClashesCategory)).toThrow(/duplicate id "frontend"/);

    const categoryClashesRoot = structuredClone(valid);
    categoryClashesRoot.categories[0]!.id = "software-engineering";
    expect(() => parseSkillTaxonomy(categoryClashesRoot)).toThrow(/duplicate id/);
  });

  it("rejects malformed ids, empty names and empty categories", () => {
    const badId = structuredClone(valid);
    badId.categories[0]!.skills[0]!.id = "React JS";
    expect(() => parseSkillTaxonomy(badId)).toThrowError(SkillTaxonomyError);

    const emptyName = structuredClone(valid);
    emptyName.categories[0]!.skills[0]!.displayName = "";
    expect(() => parseSkillTaxonomy(emptyName)).toThrowError(SkillTaxonomyError);

    const emptyCategory = structuredClone(valid);
    emptyCategory.categories[0]!.skills = [];
    expect(() => parseSkillTaxonomy(emptyCategory)).toThrowError(SkillTaxonomyError);
  });

  it("rejects non-object input", () => {
    expect(() => parseSkillTaxonomy(null)).toThrowError(SkillTaxonomyError);
    expect(() => parseSkillTaxonomy({})).toThrowError(SkillTaxonomyError);
  });
});
