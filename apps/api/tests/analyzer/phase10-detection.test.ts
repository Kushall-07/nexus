import { describe, expect, it } from "vitest";
import { parseManifest } from "../../src/analyzer/dependency/index.js";
import { detectFrameworks } from "../../src/analyzer/framework-detector.js";
import { analyzeSourceUsage } from "../../src/analyzer/source-usage-analyzer.js";
import { analyzeTests } from "../../src/analyzer/test-analyzer.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import type { DependencyObservation, RepositoryTree } from "../../src/analyzer/types.js";

const config = loadTechnologyConfig();

function technologiesOf(manifest: Parameters<typeof parseManifest>[0], content: string): string[] {
  return parseManifest(manifest, content, manifest, config)
    .dependencies.map((dependency) => dependency.technology)
    .filter((technology): technology is string => technology !== null);
}

function usage(technology: string, path: string, content: string) {
  return analyzeSourceUsage({ sampledFiles: [{ path, content }], bounded: false }, [technology], config)[0];
}

function treeOf(paths: string[]): RepositoryTree {
  return {
    entries: paths.map((path) => ({ path, type: "blob" as const, size: 10, sha: "sha" })),
    truncated: false,
  };
}

describe("Phase 10 technology detection", () => {
  describe("dependency manifests", () => {
    it("recognizes Node.js, MongoDB and PostgreSQL in package.json", () => {
      const content = JSON.stringify({
        dependencies: { mongoose: "^8", pg: "^8" },
        devDependencies: { "@types/node": "^20" },
      });
      expect(technologiesOf("package.json", content).sort()).toEqual(["mongodb", "nodejs", "postgresql"]);
    });

    it("recognizes Python and Go drivers", () => {
      expect(technologiesOf("requirements.txt", "pymongo==4.6\npsycopg2-binary==2.9\n").sort()).toEqual([
        "mongodb",
        "postgresql",
      ]);
      expect(technologiesOf("pyproject.toml", '[project]\ndependencies = ["asyncpg>=0.29", "motor"]\n').sort()).toEqual(
        ["mongodb", "postgresql"],
      );
      expect(
        technologiesOf(
          "go.mod",
          "module x\n\ngo 1.22\n\nrequire (\n\tgo.mongodb.org/mongo-driver v1.14.0\n\tgithub.com/jackc/pgx/v5 v5.5.0\n)\n",
        ).sort(),
      ).toEqual(["mongodb", "postgresql"]);
    });

    it("does not treat ORMs, query builders or lookalike names as a database", () => {
      const content = JSON.stringify({
        dependencies: { prisma: "^5", sequelize: "^6", knex: "^3", pgm: "1", "pg-format": "1", "mongodb-memory-server": "1" },
      });
      expect(technologiesOf("package.json", content)).toEqual([]);
    });

    it("does not infer Node.js from a bare package.json or from Express", () => {
      const content = JSON.stringify({ dependencies: { express: "^4", react: "^18" } });
      expect(technologiesOf("package.json", content).sort()).toEqual(["express", "react"]);
    });

    it("keeps one observation per package and dependency type (duplicate declarations)", () => {
      const content = JSON.stringify({
        dependencies: { pg: "^8" },
        devDependencies: { pg: "^8" },
      });
      const parsed = parseManifest("package.json", content, "package.json", config).dependencies;
      expect(parsed.map((dependency) => dependency.dependencyType).sort()).toEqual(["dev", "runtime"]);
    });
  });

  describe("source imports", () => {
    it("detects Node.js core-module imports in ES and CommonJS form", () => {
      const content = [
        'import { readFile } from "node:fs/promises";',
        "const cp = require('child_process');",
        "import fs from 'fs';",
      ].join("\n");
      expect(usage("nodejs", "src/a.ts", content)?.importReferenceCount).toBe(3);
    });

    it("does not match npm packages that merely resemble Node core modules", () => {
      const content = "import path from 'path-browserify';\nimport x from 'fs-extra';\nimport h from 'http-proxy';";
      expect(usage("nodejs", "src/a.ts", content)?.importReferenceCount).toBe(0);
    });

    it("detects MongoDB and PostgreSQL imports across languages", () => {
      expect(usage("mongodb", "a.ts", "import mongoose from 'mongoose';")?.importReferenceCount).toBe(1);
      expect(usage("mongodb", "a.py", "from pymongo import MongoClient")?.importReferenceCount).toBe(1);
      expect(usage("mongodb", "a.go", 'import "go.mongodb.org/mongo-driver/mongo"')?.importReferenceCount).toBe(1);
      expect(usage("postgresql", "a.ts", "import { Pool } from 'pg';")?.importReferenceCount).toBe(1);
      expect(usage("postgresql", "a.py", "import psycopg2")?.importReferenceCount).toBe(1);
      expect(usage("postgresql", "a.go", 'import "github.com/lib/pq"')?.importReferenceCount).toBe(1);
    });

    it("ignores database imports in files of another language", () => {
      expect(usage("postgresql", "notes.md", "import psycopg2")?.importReferenceCount).toBe(0);
    });

    it("does not confuse pg with lookalike modules", () => {
      expect(usage("postgresql", "a.ts", "import x from 'pg-format';")?.importReferenceCount).toBe(0);
    });
  });

  describe("frameworks stay unchanged", () => {
    it("does not report the new technologies as frameworks", () => {
      const dependencies: DependencyObservation[] = ["pg", "mongoose", "@types/node"].map((packageName) => ({
        packageName,
        technology: parseManifest(
          "package.json",
          JSON.stringify({ dependencies: { [packageName]: "1" } }),
          "package.json",
          config,
        ).dependencies[0]?.technology ?? null,
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: "1",
      }));
      expect(detectFrameworks({ dependencies, tree: treeOf([]), sampledFiles: [] }, config)).toEqual([]);
    });

    it("still detects Express and Next.js from their existing evidence", () => {
      const dependencies = parseManifest(
        "package.json",
        JSON.stringify({ dependencies: { express: "^4", next: "^14" } }),
        "package.json",
        config,
      ).dependencies;
      const frameworks = detectFrameworks(
        { dependencies, tree: treeOf(["next.config.mjs"]), sampledFiles: [] },
        config,
      );
      expect(frameworks.map((framework) => framework.technology)).toEqual(["express", "nextjs"]);
      expect(config.technologies.find((item) => item.id === "express")?.skillIds).toEqual(["express"]);
      expect(config.technologies.find((item) => item.id === "nextjs")?.skillIds).toEqual(["nextjs"]);
    });
  });

  describe("integration test signals", () => {
    it("counts only test files that follow integration conventions", () => {
      const tree = treeOf([
        "src/app.ts",
        "tests/integration/api.test.ts",
        "tests/unit/a.test.ts",
        "src/orders.integration.test.ts",
        "tests/test_integration_db.py",
        "src/integrations/slack.ts",
        "src/integration/client.ts",
      ]);
      const result = analyzeTests(tree, [], config);

      expect(result.integrationTestFilePaths).toEqual([
        "src/orders.integration.test.ts",
        "tests/integration/api.test.ts",
        "tests/test_integration_db.py",
      ]);
      expect(result.integrationTestSignal).toBe(1);
      // Existing unit/generic semantics are unchanged: integration files are still test files.
      expect(result.testFileCount).toBe(4);
    });

    it("reports none for ordinary or lookalike names", () => {
      const result = analyzeTests(treeOf(["tests/a.test.ts", "tests/reintegration.test.ts", "src/x.ts"]), [], config);
      expect(result.integrationTestFilePaths).toEqual([]);
      expect(result.integrationTestSignal).toBe(0);
    });

    it("saturates at three integration files", () => {
      const result = analyzeTests(treeOf(["tests/integration/a.ts", "tests/integration/b.ts"]), [], config);
      expect(result.integrationTestSignal).toBeCloseTo(2 / 3);
    });

    it("leaves the generic test signals identical to before", () => {
      const tree = treeOf(["src/a.ts", "src/b.ts", "tests/integration/a.test.ts"]);
      const result = analyzeTests(tree, ["react"], config);
      expect(result.testFileCount).toBe(1);
      expect(result.sourceFileCount).toBe(3);
      expect(result.genericTestSignal).toBeCloseTo(1);
    });
  });

  describe("test framework observations", () => {
    it("detects frameworks from manifests with provenance and without duplicates", () => {
      const dependencies = [
        ...parseManifest("package.json", JSON.stringify({ devDependencies: { vitest: "1", jest: "1" }, dependencies: { jest: "1" } }), "package.json", config).dependencies,
        ...parseManifest("requirements.txt", "pytest==8\n", "svc/requirements.txt", config).dependencies,
      ];
      const result = analyzeTests(treeOf([]), [], config, dependencies);

      expect(result.testFrameworks).toEqual([
        { framework: "jest", displayName: "Jest", sourcePath: "package.json" },
        { framework: "pytest", displayName: "pytest", sourcePath: "svc/requirements.txt" },
        { framework: "vitest", displayName: "Vitest", sourcePath: "package.json" },
      ]);
    });

    it("does not infer a framework from similar names", () => {
      const dependencies = parseManifest(
        "package.json",
        JSON.stringify({ devDependencies: { "jest-extended": "1", mochawesome: "1", supertest: "1" } }),
        "package.json",
        config,
      ).dependencies;
      expect(analyzeTests(treeOf([]), [], config, dependencies).testFrameworks).toEqual([]);
    });
  });
});
