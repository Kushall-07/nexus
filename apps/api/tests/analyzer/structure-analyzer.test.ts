import { describe, expect, it } from "vitest";
import { analyzeStructure } from "../../src/analyzer/structure-analyzer.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import type { RepositoryTree, TreeEntry } from "../../src/analyzer/types.js";

const config = loadTechnologyConfig();

function blob(path: string): TreeEntry {
  return { path, type: "blob", size: 10, sha: "sha" };
}

function treeOf(paths: string[]): RepositoryTree {
  return { entries: paths.map(blob), truncated: false };
}

describe("analyzeStructure", () => {
  it("detects frontend structure", () => {
    const tree = treeOf(["src/index.ts", "src/components/Button.tsx", "src/pages/Home.tsx", "src/hooks/useAuth.ts"]);
    const observations = analyzeStructure(tree, config);
    const frontend = observations.find((o) => o.category === "frontend");

    expect(frontend?.relevantStructureSignalCount).toBe(4);
    expect(frontend?.detectedPaths).toEqual(
      expect.arrayContaining(["src", "src/components", "src/pages", "src/hooks"]),
    );
  });

  it("detects backend structure", () => {
    const tree = treeOf([
      "src/controllers/user.controller.ts",
      "src/services/user.service.ts",
      "src/routes/user.routes.ts",
    ]);
    const backend = analyzeStructure(tree, config).find((o) => o.category === "backend");

    expect(backend?.relevantStructureSignalCount).toBe(3);
  });

  it("detects ML structure", () => {
    const tree = treeOf(["models/model.pkl", "datasets/train.csv", "training/train.py", "inference/predict.py"]);
    const ml = analyzeStructure(tree, config).find((o) => o.category === "ml");

    expect(ml?.relevantStructureSignalCount).toBe(4);
  });

  it("detects AI structure", () => {
    const tree = treeOf(["agents/planner.py", "tools/search.py", "prompts/system.txt", "rag/index.py", "embeddings/store.py"]);
    const ai = analyzeStructure(tree, config).find((o) => o.category === "ai");

    expect(ai?.relevantStructureSignalCount).toBe(5);
  });

  it("produces no false positives from unrelated paths", () => {
    const tree = treeOf(["README.md", "LICENSE", "notes/ideas.txt"]);
    const observations = analyzeStructure(tree, config);

    for (const observation of observations) {
      expect(observation.relevantStructureSignalCount).toBe(0);
      expect(observation.detectedPaths).toEqual([]);
    }
  });

  it("only matches exact directory segments, not partial name collisions", () => {
    // "modelsarchive" is not "models" — must not match the ML/backend pattern.
    const tree = treeOf(["modelsarchive/readme.txt"]);
    const observations = analyzeStructure(tree, config);

    for (const observation of observations) {
      expect(observation.relevantStructureSignalCount).toBe(0);
    }
  });

  it("is deterministic across repeated calls", () => {
    const tree = treeOf(["src/components/A.tsx", "src/services/B.ts"]);
    const first = analyzeStructure(tree, config);
    const second = analyzeStructure(tree, config);
    expect(first).toEqual(second);
  });
});
