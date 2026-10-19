import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RoleConfigError,
  RoleMatchInputError,
  computeRoleMatch,
  findRole,
  parseRoleCatalog,
  parseSkillTaxonomy,
  type RoleDefinition,
} from "../src/index.js";

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../config/${name}`, import.meta.url), "utf-8"));

const taxonomy = parseSkillTaxonomy(readJson("skills.json"));
const skillIds = taxonomy.skills.map((skill) => skill.id);
const skillNames = new Map(taxonomy.skills.map((skill) => [skill.id, skill.displayName]));
const catalog = parseRoleCatalog(readJson("roles.json"), skillIds);

// The frozen v1 role table, written out independently of config/roles.json:
// skill id: [weight, minimumScore].
const FROZEN: Record<string, Record<string, [number, number]>> = {
  "software-engineer": {
    python: [0.15, 50], typescript: [0.15, 50], "backend-development": [0.15, 50],
    "database-systems": [0.15, 50], "rest-apis": [0.15, 50], "software-testing": [0.15, 50], docker: [0.1, 40],
  },
  "full-stack-developer": {
    javascript: [0.1, 50], typescript: [0.1, 50], react: [0.15, 60], nodejs: [0.15, 55], "rest-apis": [0.1, 50],
    mongodb: [0.1, 45], postgresql: [0.1, 40], "software-testing": [0.1, 45], docker: [0.1, 40],
  },
  "backend-engineer": {
    python: [0.15, 50], nodejs: [0.15, 50], express: [0.1, 45], fastapi: [0.1, 45], "rest-apis": [0.15, 60],
    mongodb: [0.1, 45], postgresql: [0.1, 45], "software-testing": [0.05, 40], docker: [0.1, 40],
  },
  "ai-engineer": {
    python: [0.15, 60], "llm-applications": [0.2, 60], "agentic-ai": [0.15, 55], rag: [0.1, 45],
    "ai-apis": [0.1, 50], "rest-apis": [0.1, 45], docker: [0.1, 40], "software-testing": [0.1, 40],
  },
  "ml-engineer": {
    python: [0.2, 65], pytorch: [0.2, 60], tensorflow: [0.1, 45], "model-development": [0.2, 60],
    "software-testing": [0.1, 40], docker: [0.1, 40], "rest-apis": [0.1, 40],
  },
};

const DISPLAY_NAMES = ["Software Engineer", "Full-Stack Developer", "Backend Engineer", "AI Engineer", "ML Engineer"];

function role(requirements: Array<[string, number, number]>): RoleDefinition {
  return {
    id: "test-role",
    displayName: "Test Role",
    requirements: requirements.map(([skillId, weight, minimumScore]) => ({ skillId, weight, minimumScore })),
  };
}

function scoresOf(entries: Record<string, number>): ReadonlyMap<string, number> {
  return new Map(Object.entries(entries));
}

describe("shipped role catalog", () => {
  it("contains exactly the five frozen roles", () => {
    expect(catalog.roles).toHaveLength(5);
    expect(catalog.roles.map((entry) => entry.displayName)).toEqual(DISPLAY_NAMES);
    expect(catalog.roles.map((entry) => entry.id)).toEqual(Object.keys(FROZEN));
  });

  it("matches the frozen weights and minimum scores exactly", () => {
    for (const entry of catalog.roles) {
      const actual = Object.fromEntries(
        entry.requirements.map((requirement) => [requirement.skillId, [requirement.weight, requirement.minimumScore]]),
      );
      expect(actual).toEqual(FROZEN[entry.id]);
    }
  });

  it("has weights that sum to 1.0 for every role", () => {
    for (const entry of catalog.roles) {
      const sum = entry.requirements.reduce((total, requirement) => total + requirement.weight, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it("references only canonical taxonomy skill ids", () => {
    const known = new Set(skillIds);

    for (const entry of catalog.roles) {
      for (const requirement of entry.requirements) {
        expect(known.has(requirement.skillId)).toBe(true);
      }
    }
  });
});

describe("role catalog validation", () => {
  const raw = () => structuredClone(readJson("roles.json")) as {
    roleCatalogVersion: string;
    roles: Array<{ id: string; displayName: string; requirements: Array<Record<string, unknown>> }>;
  };
  const expectInvalid = (value: unknown, pattern: RegExp) => {
    expect(() => parseRoleCatalog(value, skillIds)).toThrow(RoleConfigError);
    expect(() => parseRoleCatalog(value, skillIds)).toThrow(pattern);
  };

  it("rejects fewer or more than five roles", () => {
    const fewer = raw();
    fewer.roles.pop();
    expectInvalid(fewer, /exactly 5 roles/);

    const more = raw();
    more.roles.push({ ...structuredClone(more.roles[0]!), id: "extra-role", displayName: "Extra Role" });
    expectInvalid(more, /exactly 5 roles/);
  });

  it("rejects an invalid role id", () => {
    const value = raw();
    value.roles[0]!.id = "Software Engineer";
    expectInvalid(value, /kebab-case/);
  });

  it("rejects a duplicate role id", () => {
    const value = raw();
    value.roles[1]!.id = value.roles[0]!.id;
    expectInvalid(value, /duplicate role id/);
  });

  it("rejects a duplicate role name", () => {
    const value = raw();
    value.roles[1]!.displayName = value.roles[0]!.displayName;
    expectInvalid(value, /duplicate role name/);
  });

  it("rejects a duplicate requirement for one skill", () => {
    const value = raw();
    value.roles[0]!.requirements[1] = { ...value.roles[0]!.requirements[0]! };
    expectInvalid(value, /more than once/);
  });

  it("rejects an unknown skill id", () => {
    const value = raw();
    value.roles[0]!.requirements[0]!.skillId = "cobol";
    expectInvalid(value, /unknown skill "cobol"/);
  });

  it("rejects a zero, negative or over-one weight", () => {
    for (const weight of [0, -0.1, 1.5]) {
      const value = raw();
      value.roles[0]!.requirements[0]!.weight = weight;
      expect(() => parseRoleCatalog(value, skillIds)).toThrow(RoleConfigError);
    }
  });

  it("rejects a missing or out-of-range minimum score", () => {
    const missing = raw();
    delete missing.roles[0]!.requirements[0]!.minimumScore;
    expectInvalid(missing, /minimumScore/);

    for (const minimumScore of [-1, 101]) {
      const value = raw();
      value.roles[0]!.requirements[0]!.minimumScore = minimumScore;
      expect(() => parseRoleCatalog(value, skillIds)).toThrow(RoleConfigError);
    }
  });

  it("rejects non-finite values", () => {
    const value = raw();
    value.roles[0]!.requirements[0]!.weight = Number.NaN;
    expect(() => parseRoleCatalog(value, skillIds)).toThrow(RoleConfigError);
  });

  it("rejects weights that do not sum to 1", () => {
    const value = raw();
    value.roles[0]!.requirements[0]!.weight = 0.2;
    expectInvalid(value, /must sum to 1/);
  });

  it("rejects unknown fields rather than ignoring them", () => {
    const value = raw();
    value.roles[0]!.requirements[0]!.critical = true;
    expect(() => parseRoleCatalog(value, skillIds)).toThrow(RoleConfigError);
  });

  it("looks roles up by id", () => {
    expect(findRole(catalog, "ai-engineer")?.displayName).toBe("AI Engineer");
    expect(findRole(catalog, "nope")).toBeUndefined();
  });
});

describe("role match", () => {
  const two = role([["python", 0.6, 50], ["docker", 0.4, 40]]);

  it("is 0 when every score is 0", () => {
    const result = computeRoleMatch({ role: two, scores: scoresOf({ python: 0, docker: 0 }), skillNames });

    expect(result.roleMatch).toBe(0);
  });

  it("is 100 when every score is 100", () => {
    const result = computeRoleMatch({ role: two, scores: scoresOf({ python: 100, docker: 100 }), skillNames });

    expect(result.roleMatch).toBeCloseTo(100, 9);
    expect(result.roleMatch).toBeLessThanOrEqual(100);
  });

  it("computes the weighted sum for known values", () => {
    const result = computeRoleMatch({ role: two, scores: scoresOf({ python: 80, docker: 30 }), skillNames });

    expect(result.roleMatch).toBeCloseTo(0.6 * 80 + 0.4 * 30, 9);
    expect(result.requirements.map((entry) => entry.weightedContribution)).toEqual([0.6 * 80, 0.4 * 30]);
  });

  it("works on every shipped role with a known mixture", () => {
    for (const entry of catalog.roles) {
      const scores = new Map(entry.requirements.map((requirement, index) => [requirement.skillId, 10 * (index + 1)]));
      const expected = entry.requirements.reduce((sum, requirement, index) => sum + 10 * (index + 1) * requirement.weight, 0);

      expect(computeRoleMatch({ role: entry, scores, skillNames }).roleMatch).toBeCloseTo(expected, 9);
    }
  });

  it("preserves fractional precision and does not round", () => {
    const result = computeRoleMatch({
      role: two,
      scores: scoresOf({ python: 33.333333333333336, docker: 66.66666666666667 }),
      skillNames,
    });

    expect(result.roleMatch).toBe(0.6 * 33.333333333333336 + 0.4 * 66.66666666666667);
    expect(result.requirements[0]!.evidenceScore).toBe(33.333333333333336);
  });

  it("treats a skill without evidence as 0 without renormalizing weights", () => {
    const result = computeRoleMatch({ role: two, scores: scoresOf({ python: 100 }), skillNames });

    expect(result.roleMatch).toBeCloseTo(60, 9);
    const docker = result.requirements[1]!;
    expect(docker).toMatchObject({ evidenceScore: 0, evidenceAvailable: false, weight: 0.4 });
    expect(result.requirements[0]!.evidenceAvailable).toBe(true);
  });

  it("does not let evidenceAvailable change the mathematics", () => {
    const explicitZero = computeRoleMatch({ role: two, scores: scoresOf({ python: 100, docker: 0 }), skillNames });
    const absent = computeRoleMatch({ role: two, scores: scoresOf({ python: 100 }), skillNames });

    expect(explicitZero.roleMatch).toBe(absent.roleMatch);
    expect(explicitZero.requirements[1]!.evidenceAvailable).toBe(true);
    expect(absent.requirements[1]!.evidenceAvailable).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const input = { role: catalog.roles[0]!, scores: scoresOf({ python: 71.3, typescript: 44.4, docker: 12 }), skillNames };

    expect(computeRoleMatch(input)).toEqual(computeRoleMatch(input));
    expect(JSON.stringify(computeRoleMatch(input))).toBe(JSON.stringify(computeRoleMatch(input)));
  });

  it("is independent of the score map's insertion order", () => {
    const a = computeRoleMatch({ role: two, scores: new Map([["python", 70], ["docker", 20]]), skillNames });
    const b = computeRoleMatch({ role: two, scores: new Map([["docker", 20], ["python", 70]]), skillNames });

    expect(a).toEqual(b);
  });

  it("keeps requirements in configured order with canonical ids and names", () => {
    const result = computeRoleMatch({ role: catalog.roles[3]!, scores: new Map(), skillNames });

    expect(result.roleId).toBe("ai-engineer");
    expect(result.roleName).toBe("AI Engineer");
    expect(result.requirements.map((entry) => entry.skillId)).toEqual(catalog.roles[3]!.requirements.map((entry) => entry.skillId));
    expect(result.requirements[1]!.skillName).toBe("LLM Applications");
  });

  it("rejects scores outside [0, 100]", () => {
    for (const bad of [-1, 100.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => computeRoleMatch({ role: two, scores: scoresOf({ python: bad }), skillNames })).toThrow(RoleMatchInputError);
    }
  });

  it("always stays within [0, 100]", () => {
    for (const entry of catalog.roles) {
      for (const value of [0, 0.0001, 50, 99.9999, 100]) {
        const scores = new Map(entry.requirements.map((requirement) => [requirement.skillId, value]));
        const { roleMatch } = computeRoleMatch({ role: entry, scores, skillNames });

        expect(roleMatch).toBeGreaterThanOrEqual(0);
        expect(roleMatch).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("gaps, deficits and critical gaps", () => {
  const single = role([["python", 1, 50]]);
  const at = (score: number) => computeRoleMatch({ role: single, scores: scoresOf({ python: score }), skillNames }).requirements[0]!;

  it("reports a negative gap, positive deficit and critical gap below the minimum", () => {
    expect(at(42)).toMatchObject({ gap: -8, deficit: 8, criticalGap: true });
  });

  it("reports a zero gap, zero deficit and no critical gap exactly at the minimum", () => {
    expect(at(50)).toMatchObject({ gap: 0, deficit: 0, criticalGap: false });
  });

  it("reports a positive gap, zero deficit and no critical gap above the minimum", () => {
    expect(at(73.5)).toMatchObject({ gap: 23.5, deficit: 0, criticalGap: false });
  });

  it("never reports a negative deficit", () => {
    for (const score of [0, 10, 49.999, 50, 50.001, 100]) {
      expect(at(score).deficit).toBeGreaterThanOrEqual(0);
    }
  });

  it("treats a score just below the minimum as critical", () => {
    expect(at(49.999999).criticalGap).toBe(true);
  });

  const mixed = role([["python", 0.5, 50], ["docker", 0.3, 40], ["react", 0.2, 60]]);

  it("flags a single critical gap even when the overall match is high", () => {
    const result = computeRoleMatch({ role: mixed, scores: scoresOf({ python: 100, docker: 39, react: 100 }), skillNames });

    expect(result.roleMatch).toBeCloseTo(0.5 * 100 + 0.3 * 39 + 0.2 * 100, 9);
    expect(result.roleMatch).toBeGreaterThan(80);
    expect(result.criticalGaps.map((entry) => entry.skillId)).toEqual(["docker"]);
  });

  it("flags several critical gaps in configured order", () => {
    const result = computeRoleMatch({ role: mixed, scores: scoresOf({ python: 10, docker: 10, react: 90 }), skillNames });

    expect(result.criticalGaps.map((entry) => entry.skillId)).toEqual(["python", "docker"]);
  });

  it("reports no critical gaps when every minimum is met, even with a low overall match", () => {
    const result = computeRoleMatch({ role: mixed, scores: scoresOf({ python: 50, docker: 40, react: 60 }), skillNames });

    expect(result.criticalGaps).toEqual([]);
    expect(result.roleMatch).toBeLessThan(55);
  });

  it("keeps the critical-gap list identical to the requirement flags", () => {
    for (const entry of catalog.roles) {
      for (const value of [0, 45, 60, 100]) {
        const scores = new Map(entry.requirements.map((requirement) => [requirement.skillId, value]));
        const result = computeRoleMatch({ role: entry, scores, skillNames });

        expect(result.criticalGaps).toEqual(result.requirements.filter((requirement) => requirement.criticalGap));
      }
    }
  });

  it("marks every requirement critical when there is no evidence at all", () => {
    const result = computeRoleMatch({ role: catalog.roles[0]!, scores: new Map(), skillNames });

    expect(result.roleMatch).toBe(0);
    expect(result.criticalGaps).toHaveLength(catalog.roles[0]!.requirements.length);
    expect(result.requirements.every((entry) => !entry.evidenceAvailable)).toBe(true);
  });
});
