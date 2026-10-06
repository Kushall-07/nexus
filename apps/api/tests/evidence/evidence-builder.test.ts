import { describe, expect, it } from "vitest";
import { EVIDENCE_TYPES, EVIDENCE_TYPE_SIGNAL, buildEvidenceKey } from "@nexus/domain";
import type { NewEvidenceItem } from "@nexus/domain";
import { buildEvidence } from "../../src/evidence/evidence-builder.js";
import { loadEvidenceConfig } from "../../src/evidence/evidence-config.js";
import type { RepositoryAnalysis } from "../../src/analyzer/types.js";
import {
  DETECTED_AT,
  REPOSITORY_ID,
  USER_ID,
  emptyAnalysis,
  richAnalysis,
} from "./fixtures.js";

function run(analysis: RepositoryAnalysis, config = loadEvidenceConfig()) {
  return buildEvidence(
    { userId: USER_ID, repositoryId: REPOSITORY_ID, analysis, detectedAt: DETECTED_AT },
    config,
  );
}

function find(items: NewEvidenceItem[], skillId: string, evidenceType: string) {
  return items.filter((item) => item.skillId === skillId && item.evidenceType === evidenceType);
}

describe("buildEvidence", () => {
  describe("empty and unrecognized input", () => {
    it("produces nothing for an empty repository", () => {
      const result = run(emptyAnalysis());
      expect(result.items).toEqual([]);
      expect(result.unmappedTechnologies).toEqual([]);
    });

    it("produces nothing when no recognized skill is present", () => {
      const result = run(
        emptyAnalysis({
          languages: {
            bytesByLanguage: { Rust: 100, CSS: 50 },
            percentageByLanguage: { Rust: 66.67, CSS: 33.33 },
            totalBytes: 150,
          },
          activity: { ...emptyAnalysis().activity, recentCommitCount: 5, activity: 0.5 },
        }),
      );

      expect(result.items).toEqual([]);
    });

    it("tolerates missing optional collections on malformed observations", () => {
      const malformed = {
        repositoryId: REPOSITORY_ID,
        repositoryFullName: "o/r",
        analyzedAt: DETECTED_AT.toISOString(),
      } as unknown as RepositoryAnalysis;

      expect(run(malformed).items).toEqual([]);
    });

    it("skips observations with non-finite signals instead of emitting bad strengths", () => {
      const analysis = richAnalysis();
      analysis.sourceUsage[0]!.sourceUsage = Number.NaN;
      analysis.activity.activity = Number.POSITIVE_INFINITY;

      const { items } = run(analysis);

      expect(find(items, "react", "SOURCE_FILE")).toHaveLength(0);
      expect(items.some((item) => item.evidenceType === "COMMIT_ACTIVITY")).toBe(false);
    });
  });

  describe("dependency evidence", () => {
    it("maps a dependency to its skill with manifest provenance", () => {
      const [item] = find(run(richAnalysis()).items, "react", "DEPENDENCY");

      expect(item).toMatchObject({
        userId: USER_ID,
        repositoryId: REPOSITORY_ID,
        skillId: "react",
        evidenceType: "DEPENDENCY",
        signal: "dependency",
        value: "react",
        normalizedStrength: 1,
        sourcePath: "package.json",
        sourceReference: "runtime:react",
        explanation: "React is declared as a runtime dependency in package.json.",
        detectedAt: DETECTED_AT,
      });
    });

    it("keeps the manifest path for nested manifests", () => {
      const [item] = find(run(richAnalysis()).items, "fastapi", "DEPENDENCY");
      expect(item?.sourcePath).toBe("backend/requirements.txt");
      expect(item?.explanation).toBe("FastAPI is declared as a dependency in backend/requirements.txt.");
    });

    it("ignores dependencies with no technology", () => {
      const { items } = run(richAnalysis());
      expect(items.some((item) => item.value === "left-pad")).toBe(false);
    });

    it("never invents a skill for a technology without a canonical skill", () => {
      const result = run(richAnalysis());

      expect(result.items.some((item) => item.value === "django")).toBe(false);
      expect(result.items.some((item) => item.sourcePath === "manage.py")).toBe(false);
      expect(result.unmappedTechnologies).toEqual(["django"]);
    });

    it("distinguishes dependency classifications as separate observations", () => {
      const analysis = emptyAnalysis({
        dependencies: [
          { packageName: "react", technology: "react", source: "package.json", sourcePath: "package.json", dependencyType: "dev", versionConstraint: null },
          { packageName: "react", technology: "react", source: "package.json", sourcePath: "package.json", dependencyType: "peer", versionConstraint: null },
        ],
      });
      const items = find(run(analysis).items, "react", "DEPENDENCY");

      expect(items.map((item) => item.explanation)).toEqual([
        "React is declared as a dev dependency in package.json.",
        "React is declared as a peer dependency in package.json.",
      ]);
    });
  });

  describe("framework evidence", () => {
    it("explains why the framework was detected and records provenance", () => {
      const [item] = find(run(richAnalysis()).items, "react", "FRAMEWORK");

      expect(item).toMatchObject({
        signal: "framework",
        normalizedStrength: 1,
        value: "react",
        sourcePath: "package.json",
      });
      expect(item?.explanation).toBe(
        "React was detected from a dependency declaration in package.json, an import in src/App.tsx.",
      );
      expect(item?.sourceReference).toBe("dependency:package.json; source:src/App.tsx");
    });

    it("does not detect frameworks from language alone", () => {
      const analysis = emptyAnalysis({
        languages: {
          bytesByLanguage: { TypeScript: 100, Python: 100, JavaScript: 100 },
          percentageByLanguage: { TypeScript: 33.33, Python: 33.33, JavaScript: 33.33 },
          totalBytes: 300,
        },
      });
      const { items } = run(analysis);

      expect(items.map((item) => item.skillId).sort()).toEqual(["javascript", "python", "typescript"]);
      expect(items.every((item) => item.evidenceType === "LANGUAGE")).toBe(true);
    });
  });

  describe("source file evidence", () => {
    it("reuses the Phase 3 sourceUsage signal and preserves the file path", () => {
      const [item] = find(run(richAnalysis()).items, "react", "SOURCE_FILE");

      expect(item).toMatchObject({
        signal: "sourceUsage",
        normalizedStrength: 0.68,
        value: 3,
        sourcePath: "src/App.tsx",
        sourceReference: "src/App.tsx, src/components/Dashboard.tsx",
      });
      expect(item?.explanation).toContain("React source usage was detected in src/App.tsx");
      expect(item?.explanation).toContain("bounded by the request budget");
    });

    it("emits nothing for a technology with no observed usage", () => {
      expect(find(run(richAnalysis()).items, "fastapi", "SOURCE_FILE")).toHaveLength(0);
    });
  });

  describe("language evidence", () => {
    it("supports only the matching programming skill with exact share precision", () => {
      const items = run(richAnalysis()).items;
      const typescript = find(items, "typescript", "LANGUAGE")[0];

      expect(typescript).toMatchObject({
        signal: "sourceUsage",
        value: 65,
        normalizedStrength: 0.65,
        sourceReference: "github:languages",
      });
      expect(typescript?.sourcePath).toBeUndefined();
      expect(find(items, "python", "LANGUAGE")[0]?.normalizedStrength).toBe(0.3);
      // TypeScript 65% must not become React evidence, and CSS has no skill.
      expect(find(items, "react", "LANGUAGE")).toHaveLength(0);
      expect(items.some((item) => item.observationKey === "language:CSS")).toBe(false);
    });
  });

  describe("project structure evidence", () => {
    it("keeps structure evidence weak and honest", () => {
      const [item] = find(run(richAnalysis()).items, "ui-development", "PROJECT_STRUCTURE");

      expect(item).toMatchObject({
        signal: "projectStructure",
        value: 2,
        sourcePath: "src",
        sourceReference: "src, src/components",
      });
      // 2 of the 4 configured frontend directory patterns.
      expect(item?.normalizedStrength).toBe(0.5);
    });

    it("emits no structure evidence when nothing matched", () => {
      expect(find(run(richAnalysis()).items, "rest-apis", "PROJECT_STRUCTURE")).toHaveLength(0);
    });
  });

  describe("docker evidence", () => {
    it("records each Docker artifact with its path", () => {
      const items = find(run(richAnalysis()).items, "docker", "DOCKER");

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        signal: "projectStructure",
        normalizedStrength: 1,
        sourcePath: "Dockerfile",
        value: "dockerfile",
        explanation: "Dockerfile is present at the repository root.",
      });
      expect(items[1]).toMatchObject({
        sourcePath: "deploy/docker-compose.yml",
        value: "compose",
        explanation: "Docker Compose file is present at deploy/docker-compose.yml.",
      });
    });
  });

  describe("test evidence", () => {
    it("combines generic and skill-specific testing signals per technology", () => {
      const [item] = find(run(richAnalysis()).items, "react", "TEST");

      expect(item?.signal).toBe("testing");
      expect(item?.normalizedStrength).toBeCloseTo(0.5 * 1 + 0.5 * (2 / 3), 12);
      expect(item?.value).toBe(2);
      expect(item?.sourcePath).toBeUndefined();
      expect(item?.explanation).toBe(
        "2 of 4 test files relate to React (matched by file type or path).",
      );
    });

    it("records generic test presence against the generic testing skill", () => {
      const [item] = find(run(richAnalysis()).items, "unit-testing", "TEST");

      expect(item).toMatchObject({
        normalizedStrength: 1,
        value: 4,
        sourcePath: "src/App.test.tsx",
      });
    });

    it("emits nothing for technologies without referencing tests", () => {
      expect(find(run(richAnalysis()).items, "fastapi", "TEST")).toHaveLength(0);
    });
  });

  describe("README evidence", () => {
    it("records README mentions only", () => {
      const items = run(richAnalysis()).items;
      const [react] = find(items, "react", "README");

      expect(react).toMatchObject({
        signal: "documentation",
        normalizedStrength: 1,
        sourcePath: "README.md",
        explanation: "README.md contains an observable reference to React.",
      });
      expect(find(items, "fastapi", "README")).toHaveLength(0);
    });
  });

  describe("activity evidence", () => {
    it("attaches repository activity to each skill that has other evidence", () => {
      const { items } = run(richAnalysis());
      const activity = items.filter((item) => item.evidenceType === "COMMIT_ACTIVITY");
      const otherSkills = new Set(
        items.filter((item) => item.evidenceType !== "COMMIT_ACTIVITY").map((item) => item.skillId),
      );

      expect(new Set(activity.map((item) => item.skillId))).toEqual(otherSkills);
      expect(activity[0]).toMatchObject({
        signal: "activity",
        value: 10,
        normalizedStrength: 0.5,
        sourceReference: "github:commits:last-90-days",
      });
      expect(activity[0]?.sourcePath).toBeUndefined();
    });

    it("emits no activity evidence without recent commits", () => {
      const analysis = richAnalysis();
      analysis.activity.recentCommitCount = 0;
      analysis.activity.activity = 0;

      expect(run(analysis).items.some((item) => item.evidenceType === "COMMIT_ACTIVITY")).toBe(false);
    });

    it("makes no qualitative claims in explanations", () => {
      const { items } = run(richAnalysis());
      const text = items.map((item) => item.explanation).join(" ").toLowerCase();

      for (const forbidden of ["expert", "skilled", "excellent", "senior", "job-ready", "production-ready"]) {
        expect(text).not.toContain(forbidden);
      }
    });
  });

  describe("invariants", () => {
    it("gives every item a skill, type, matching signal, bounded strength and explanation", () => {
      const { items } = run(richAnalysis());
      const skills = new Set(loadEvidenceConfig().taxonomy.skills.map((skill) => skill.id));

      expect(items.length).toBeGreaterThan(10);

      for (const item of items) {
        expect(skills.has(item.skillId)).toBe(true);
        expect(EVIDENCE_TYPES).toContain(item.evidenceType);
        expect(item.signal).toBe(EVIDENCE_TYPE_SIGNAL[item.evidenceType]);
        expect(item.normalizedStrength).toBeGreaterThanOrEqual(0);
        expect(item.normalizedStrength).toBeLessThanOrEqual(1);
        expect(item.explanation.length).toBeGreaterThan(0);
        expect(item.userId).toBe(USER_ID);
        expect(item.repositoryId).toBe(REPOSITORY_ID);
      }
    });

    it("clamps out-of-range upstream signals into [0, 1]", () => {
      const analysis = richAnalysis();
      analysis.sourceUsage[0]!.sourceUsage = 4;
      analysis.testing.genericTestSignal = -2;

      for (const item of run(analysis).items) {
        expect(item.normalizedStrength).toBeGreaterThanOrEqual(0);
        expect(item.normalizedStrength).toBeLessThanOrEqual(1);
      }
    });

    it("only reports provenance paths that exist in the observations", () => {
      const analysis = richAnalysis();
      const knownPaths = new Set([
        "package.json",
        "backend/requirements.txt",
        "src/App.tsx",
        "src/components/Dashboard.tsx",
        "src",
        "src/components",
        "Dockerfile",
        "deploy/docker-compose.yml",
        "src/App.test.tsx",
        "README.md",
      ]);

      for (const item of run(analysis).items) {
        if (item.sourcePath) {
          expect(knownPaths.has(item.sourcePath)).toBe(true);
        }
      }
    });

    it("includes no scoring concepts in its output", () => {
      const keys = new Set(run(richAnalysis()).items.flatMap((item) => Object.keys(item)));
      expect(keys.has("score")).toBe(false);
      expect(keys.has("rank")).toBe(false);
    });
  });

  describe("determinism and deduplication", () => {
    it("produces identical output for identical input", () => {
      expect(run(richAnalysis())).toEqual(run(richAnalysis()));
    });

    it("is independent of input ordering", () => {
      const forward = richAnalysis();
      const reversed = richAnalysis();
      reversed.dependencies.reverse();
      reversed.frameworks.reverse();
      reversed.frameworks.forEach((framework) => framework.evidence.reverse());
      reversed.sourceUsage.reverse();
      reversed.docker.composePaths.reverse();

      expect(run(reversed).items).toEqual(run(forward).items);
    });

    it("does not let detectedAt influence identity or semantics", () => {
      const first = run(richAnalysis());
      const later = buildEvidence({
        userId: USER_ID,
        repositoryId: REPOSITORY_ID,
        analysis: richAnalysis(),
        detectedAt: new Date("2030-01-01T00:00:00.000Z"),
      });

      expect(later.items.map((item) => buildEvidenceKey(item))).toEqual(
        first.items.map((item) => buildEvidenceKey(item)),
      );
      expect(later.items.map(({ detectedAt: _a, ...rest }) => rest)).toEqual(
        first.items.map(({ detectedAt: _b, ...rest }) => rest),
      );
    });

    it("produces unique evidence keys and collapses exact duplicate observations", () => {
      const analysis = richAnalysis();
      analysis.dependencies.push({ ...analysis.dependencies[0]! });
      analysis.dependencies.push({ ...analysis.dependencies[0]! });

      const { items } = run(analysis);
      const keys = items.map((item) => buildEvidenceKey(item));

      expect(new Set(keys).size).toBe(keys.length);
      expect(find(items, "react", "DEPENDENCY")).toHaveLength(1);
    });

    it("keeps legitimate provenance from different manifests", () => {
      const analysis = emptyAnalysis({
        dependencies: ["package.json", "apps/web/package.json"].map((sourcePath) => ({
          packageName: "react",
          technology: "react",
          source: "package.json" as const,
          sourcePath,
          dependencyType: "runtime" as const,
          versionConstraint: null,
        })),
      });

      expect(find(run(analysis).items, "react", "DEPENDENCY")).toHaveLength(2);
    });

    it("sorts output by skill then evidence type", () => {
      const { items } = run(richAnalysis());
      const order = items.map((item) => `${item.skillId}:${EVIDENCE_TYPES.indexOf(item.evidenceType)}`);
      const sorted = [...order].sort((a, b) => {
        const [skillA, typeA] = a.split(":");
        const [skillB, typeB] = b.split(":");
        return skillA! < skillB! ? -1 : skillA! > skillB! ? 1 : Number(typeA) - Number(typeB);
      });

      expect(order).toEqual(sorted);
    });
  });

  describe("multiple mapped skills", () => {
    it("emits one item per skill when a technology maps to several", () => {
      const config = structuredClone(loadEvidenceConfig());
      config.technologies.technologies.find((t) => t.id === "react")!.skillIds = [
        "react",
        "ui-development",
      ];

      const { items } = run(richAnalysis(), config);

      expect(find(items, "react", "DEPENDENCY")).toHaveLength(1);
      expect(find(items, "ui-development", "DEPENDENCY")).toHaveLength(1);
    });

    it("rejects a mapping that produces an unknown skill", () => {
      const config = structuredClone(loadEvidenceConfig());
      config.technologies.technologies.find((t) => t.id === "react")!.skillIds = ["ghost-skill"];

      expect(() => run(richAnalysis(), config)).toThrow(/ghost-skill/);
    });
  });
});
