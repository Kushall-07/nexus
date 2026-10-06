import { beforeEach, describe, expect, it } from "vitest";
import { parseSkillTaxonomy } from "@nexus/domain";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import {
  loadEvidenceConfig,
  resetEvidenceConfigCache,
  validateEvidenceConfig,
} from "../../src/evidence/evidence-config.js";
import { AppError } from "../../src/utils/errors.js";

describe("evidence configuration", () => {
  beforeEach(() => resetEvidenceConfigCache());

  it("loads the canonical taxonomy with the frozen skill set", () => {
    const { taxonomy } = loadEvidenceConfig();

    expect(taxonomy.root.displayName).toBe("Software Engineering");
    expect(taxonomy.categories.map((category) => category.displayName)).toEqual([
      "Programming",
      "Frontend",
      "Backend",
      "Databases",
      "Testing",
      "DevOps",
      "AI Engineering",
      "Machine Learning",
    ]);
    expect(taxonomy.skills.map((skill) => skill.displayName)).toEqual([
      "Python", "JavaScript", "TypeScript", "Java", "Go",
      "React", "Next.js", "UI Development",
      "Node.js", "Express", "FastAPI", "REST APIs",
      "MongoDB", "PostgreSQL", "SQL",
      "Unit Testing", "Integration Testing",
      "Docker", "CI/CD",
      "LLM Applications", "Agentic AI", "RAG", "AI APIs",
      "PyTorch", "TensorFlow", "Model Development",
    ]);
  });

  it("caches the loaded configuration", () => {
    expect(loadEvidenceConfig()).toBe(loadEvidenceConfig());
  });

  it("maps technologies to skills from the single technology config", () => {
    const { technologies } = loadEvidenceConfig();
    const skillsOf = (id: string) => technologies.technologies.find((t) => t.id === id)?.skillIds;

    expect(skillsOf("react")).toEqual(["react"]);
    expect(skillsOf("fastapi")).toEqual(["fastapi"]);
    expect(skillsOf("nextjs")).toEqual(["nextjs"]);
    expect(skillsOf("express")).toEqual(["express"]);
    // Technologies without a taxonomy skill stay unmapped rather than guessed.
    expect(skillsOf("django")).toEqual([]);
    expect(skillsOf("gin")).toEqual([]);
  });

  it("does not map languages onto frameworks", () => {
    const { languageSkills } = loadEvidenceConfig().technologies;

    expect(languageSkills.Python).toBe("python");
    expect(languageSkills.JavaScript).toBe("javascript");
    expect(Object.values(languageSkills)).not.toContain("react");
    expect(Object.values(languageSkills)).not.toContain("fastapi");
    expect(Object.values(languageSkills)).not.toContain("pytorch");
  });

  it("rejects a technology mapped to an unknown skill", () => {
    const technologies = structuredClone(loadTechnologyConfig());
    technologies.technologies[0]!.skillIds = ["not-a-skill"];
    const taxonomy = loadEvidenceConfig().taxonomy;

    expect(() => validateEvidenceConfig({ taxonomy, technologies })).toThrowError(AppError);
    try {
      validateEvidenceConfig({ taxonomy, technologies });
    } catch (error) {
      expect((error as AppError).code).toBe("INVALID_TECHNOLOGY_MAPPING");
    }
  });

  it("rejects an unknown language, docker, testing, or structure mapping", () => {
    const taxonomy = loadEvidenceConfig().taxonomy;
    const base = () => structuredClone(loadTechnologyConfig());

    const language = base();
    language.languageSkills.Rust = "rust";
    expect(() => validateEvidenceConfig({ taxonomy, technologies: language })).toThrow(/rust/);

    const docker = base();
    docker.observationSkills.docker = ["kubernetes"];
    expect(() => validateEvidenceConfig({ taxonomy, technologies: docker })).toThrow(/kubernetes/);

    const testing = base();
    testing.observationSkills.genericTesting = ["fuzzing"];
    expect(() => validateEvidenceConfig({ taxonomy, technologies: testing })).toThrow(/fuzzing/);

    const structure = base();
    structure.observationSkills.structure.mobile = ["react"];
    expect(() => validateEvidenceConfig({ taxonomy, technologies: structure })).toThrow(/mobile/);
  });

  it("accepts a valid configuration", () => {
    const taxonomy = parseSkillTaxonomy({
      root: { id: "root", displayName: "Root" },
      categories: [{ id: "c", displayName: "C", skills: [{ id: "react", displayName: "React" }] }],
    });
    const technologies = structuredClone(loadTechnologyConfig());
    for (const technology of technologies.technologies) technology.skillIds = [];
    technologies.languageSkills = {};
    technologies.observationSkills = { docker: [], genericTesting: [], structure: {} };

    expect(() => validateEvidenceConfig({ taxonomy, technologies })).not.toThrow();
  });
});
