import { describe, expect, it } from "vitest";
import { scoreSkills, type ScoringEvidence, type SignalType } from "@nexus/domain";
import { loadScoringConfig } from "../../src/scoring/scoring-config.js";
import { buildEvidence } from "../../src/evidence/evidence-builder.js";
import { DETECTED_AT, REPOSITORY_ID, USER_ID, emptyAnalysis, richAnalysis } from "./fixtures.js";
import type { RepositoryAnalysis } from "../../src/analyzer/types.js";

function build(analysis: RepositoryAnalysis) {
  return buildEvidence({ userId: USER_ID, repositoryId: REPOSITORY_ID, analysis, detectedAt: DETECTED_AT }).items;
}

const NEW_SKILLS = new Set(["nodejs", "mongodb", "postgresql", "integration-testing"]);

function withPhase10Observations(): RepositoryAnalysis {
  const base = richAnalysis();
  return {
    ...base,
    dependencies: [
      ...base.dependencies,
      { packageName: "mongoose", technology: "mongodb", source: "package.json", sourcePath: "package.json", dependencyType: "runtime", versionConstraint: "^8" },
      { packageName: "pg", technology: "postgresql", source: "package.json", sourcePath: "package.json", dependencyType: "runtime", versionConstraint: "^8" },
      { packageName: "@types/node", technology: "nodejs", source: "package.json", sourcePath: "package.json", dependencyType: "dev", versionConstraint: "^20" },
    ],
    sourceUsage: [
      ...base.sourceUsage,
      {
        technology: "postgresql",
        displayName: "PostgreSQL",
        importReferenceCount: 2,
        relevantSourceFileCount: 1,
        importSignal: 2 / 3,
        fileUsageSignal: 0.1,
        sourceUsage: 0.6 * (2 / 3) + 0.4 * 0.1,
        relevantSourceFilePaths: ["src/db.ts"],
        sampledSourceFilePaths: ["src/db.ts"],
        bounded: false,
      },
    ],
    testing: {
      ...base.testing,
      // An existing test file that follows an integration convention: the
      // generic test counts stay exactly as in the baseline fixture.
      integrationTestFilePaths: ["tests/api.test.py"],
      integrationTestSignal: 1 / 3,
    },
  };
}

function scores(analysis: RepositoryAnalysis): Map<string, number> {
  const evidence: ScoringEvidence[] = build(analysis).map((item, index) => ({
    evidenceId: String(index),
    repositoryId: REPOSITORY_ID,
    skillId: item.skillId,
    signal: item.signal as SignalType,
    normalizedStrength: item.normalizedStrength,
  }));
  const result = scoreSkills(
    {
      evidence,
      repositories: [
        { repositoryId: REPOSITORY_ID, sourceFileCount: analysis.testing.sourceFileCount, relevantStructureSignalCount: 6 },
      ],
    },
    loadScoringConfig(),
  );
  return new Map(result.skillScores.map((score) => [score.skillId, score.score]));
}

describe("Phase 10 evidence", () => {
  describe("regression: deterministic scores", () => {
    it("scores every pre-existing skill exactly as before and only adds the new skills", () => {
      const before = scores(richAnalysis());
      const after = scores(withPhase10Observations());

      for (const [skillId, score] of before) {
        expect(after.get(skillId), skillId).toBe(score);
      }
      const added = [...after.keys()].filter((skillId) => !before.has(skillId)).sort();
      expect(added).toEqual(["integration-testing", "mongodb", "nodejs", "postgresql"]);
      for (const skillId of added) {
        expect(after.get(skillId)).toBeGreaterThan(0);
        expect(after.get(skillId)).toBeLessThanOrEqual(100);
      }
    });

    it("documents the expected score of each newly detected skill on the reference fixture", () => {
      const after = scores(withPhase10Observations());
      // Reference values, also listed in docs/implementation/phase10-richer-evidence.md.
      expect(after.get("postgresql")).toBeCloseTo(60, 6);
      expect(after.get("integration-testing")).toBeCloseTo(43.75, 6);
      expect(after.get("mongodb")).toBeCloseTo(31.25, 6);
      expect(after.get("nodejs")).toBeCloseTo(31.25, 6);
      expect(after.get("postgresql")).toBeGreaterThan(after.get("mongodb") ?? 0);
    });
  });

  describe("regression: previously detected skills", () => {
    it("leaves evidence for every pre-existing skill identical when new evidence appears", () => {
      const before = build(richAnalysis());
      const after = build(withPhase10Observations()).filter((item) => !NEW_SKILLS.has(item.skillId));
      const sameSkillsBefore = before.filter((item) => !NEW_SKILLS.has(item.skillId));

      expect(after).toEqual(sameSkillsBefore);
    });

    it("emits no integration evidence for repositories without integration tests", () => {
      expect(build(richAnalysis()).some((item) => item.skillId === "integration-testing")).toBe(false);
    });

    it("keeps unit-testing evidence unchanged by integration files", () => {
      const analysis = withPhase10Observations();
      const unit = build(analysis).find((item) => item.skillId === "unit-testing" && item.observationKey === "test:generic");
      expect(unit?.value).toBe(analysis.testing.testFileCount);
    });
  });

  describe("new technologies", () => {
    it("maps dependencies to the Node.js, MongoDB and PostgreSQL skills with provenance", () => {
      const items = build(withPhase10Observations()).filter((item) => item.evidenceType === "DEPENDENCY");
      for (const skillId of ["nodejs", "mongodb", "postgresql"]) {
        const item = items.find((candidate) => candidate.skillId === skillId);
        expect(item?.sourcePath).toBe("package.json");
        expect(item?.normalizedStrength).toBe(1);
      }
    });

    it("emits source evidence only when imports were observed", () => {
      const items = build(withPhase10Observations()).filter((item) => item.evidenceType === "SOURCE_FILE");
      expect(items.some((item) => item.skillId === "postgresql" && item.sourcePath === "src/db.ts")).toBe(true);
      expect(items.some((item) => item.skillId === "mongodb")).toBe(false);
    });

    it("still never invents a skill for Databases", () => {
      expect(build(withPhase10Observations()).some((item) => item.skillId === "database-systems")).toBe(false);
    });
  });

  describe("integration test evidence", () => {
    it("records integration files against Integration Testing only", () => {
      const items = build(withPhase10Observations()).filter((item) => item.skillId === "integration-testing" && item.evidenceType === "TEST");
      expect(items).toHaveLength(1);
      const item = items[0]!;
      expect(item.signal).toBe("testing");
      expect(item.sourcePath).toBe("tests/api.test.py");
      expect(item.value).toBe(1);
      expect(item.observationKey).toBe("test:integration");
      expect(item.normalizedStrength).toBeCloseTo(0.5 * withPhase10Observations().testing.genericTestSignal + 0.5 * (1 / 3));
    });

    it("tolerates analyses that predate the integration fields", () => {
      const analysis = emptyAnalysis();
      expect(() => build(analysis)).not.toThrow();
    });

    it("is deterministic and de-duplicated", () => {
      const analysis = withPhase10Observations();
      expect(build(analysis)).toEqual(build(analysis));
      const keys = build(analysis).map((item) => `${item.skillId}|${item.evidenceType}|${item.sourcePath}|${item.observationKey}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe("test frameworks are not scored", () => {
    it("produces no evidence from the testFrameworks observation", () => {
      const analysis = withPhase10Observations();
      const withFrameworks: RepositoryAnalysis = {
        ...analysis,
        testing: { ...analysis.testing, testFrameworks: [{ framework: "jest", displayName: "Jest", sourcePath: "package.json" }] },
      };
      expect(build(withFrameworks)).toEqual(build(analysis));
    });
  });
});
