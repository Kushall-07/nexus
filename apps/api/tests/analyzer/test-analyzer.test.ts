import { describe, expect, it } from "vitest";
import { analyzeTests } from "../../src/analyzer/test-analyzer.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import type { RepositoryTree, TreeEntry } from "../../src/analyzer/types.js";

const config = loadTechnologyConfig();

function blob(path: string): TreeEntry {
  return { path, type: "blob", size: 10, sha: "sha" };
}

function treeOf(paths: string[]): RepositoryTree {
  return { entries: paths.map(blob), truncated: false };
}

describe("analyzeTests", () => {
  it("reports zero signals when there are no tests", () => {
    const tree = treeOf(["src/index.ts", "src/app.ts"]);
    const result = analyzeTests(tree, ["react"], config);

    expect(result.testFileCount).toBe(0);
    expect(result.sourceFileCount).toBe(2);
    expect(result.testRatio).toBe(0);
    expect(result.genericTestSignal).toBe(0);
  });

  it("detects *.test.* and *.spec.* files", () => {
    const tree = treeOf(["src/foo.ts", "src/foo.test.ts", "src/bar.spec.ts"]);
    const result = analyzeTests(tree, [], config);
    expect(result.testFileCount).toBe(2);
  });

  it("detects test/, tests/, and __tests__/ directories", () => {
    const tree = treeOf([
      "src/foo.ts",
      "test/foo.py",
      "tests/bar.py",
      "__tests__/component.test.tsx",
    ]);
    const result = analyzeTests(tree, [], config);
    expect(result.testFileCount).toBe(3);
  });

  it("computes testRatio and genericTestSignal exactly", () => {
    // 2 test files out of 10 source files => ratio 0.20 => signal saturates at 1.
    const sourcePaths = Array.from({ length: 8 }, (_, i) => `src/file${i}.ts`);
    const tree = treeOf([...sourcePaths, "src/a.test.ts", "src/b.test.ts"]);
    const result = analyzeTests(tree, [], config);

    expect(result.sourceFileCount).toBe(10);
    expect(result.testFileCount).toBe(2);
    expect(result.testRatio).toBeCloseTo(0.2);
    expect(result.genericTestSignal).toBe(1);
  });

  it("handles sourceFiles = 0 without producing NaN or Infinity", () => {
    const tree: RepositoryTree = { entries: [], truncated: false };
    const result = analyzeTests(tree, [], config);

    expect(result.sourceFileCount).toBe(0);
    expect(result.testRatio).toBe(0);
    expect(result.genericTestSignal).toBe(0);
    expect(Number.isFinite(result.testRatio)).toBe(true);
    expect(Number.isFinite(result.genericTestSignal)).toBe(true);
  });

  it("computes skill-specific test signal via extension and path matching", () => {
    const tree = treeOf([
      "src/App.tsx",
      "src/App.test.tsx",
      "src/Button.test.tsx",
      "src/Nav.test.tsx",
      "src/Unrelated.test.py",
    ]);
    const result = analyzeTests(tree, ["react"], config);
    const react = result.perTechnology.find((t) => t.technology === "react");

    // All three .tsx test files count toward react (matching extension);
    // saturates at 3 => signal 1.
    expect(react?.skillReferencedTestFiles).toBe(3);
    expect(react?.skillSpecificTestSignal).toBe(1);
  });

  it("returns no perTechnology entries when no technologies are relevant", () => {
    const tree = treeOf(["src/App.test.tsx"]);
    const result = analyzeTests(tree, [], config);
    expect(result.perTechnology).toEqual([]);
  });

  it("excludes vendored/build directories from source and test counts", () => {
    const tree = treeOf(["node_modules/pkg/index.test.js", "dist/bundle.test.js", "src/real.test.ts"]);
    const result = analyzeTests(tree, [], config);

    expect(result.testFileCount).toBe(1);
    expect(result.sourceFileCount).toBe(1);
  });
});
