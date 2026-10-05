import { describe, expect, it } from "vitest";
import { analyzeDocker } from "../../src/analyzer/docker-analyzer.js";
import type { RepositoryTree, TreeEntry } from "../../src/analyzer/types.js";

function blob(path: string): TreeEntry {
  return { path, type: "blob", size: 10, sha: "sha" };
}

describe("analyzeDocker", () => {
  it("detects a Dockerfile", () => {
    const tree: RepositoryTree = { entries: [blob("Dockerfile")], truncated: false };
    const result = analyzeDocker(tree);

    expect(result.dockerfilePresent).toBe(true);
    expect(result.composePresent).toBe(false);
    expect(result.dockerfilePaths).toEqual(["Dockerfile"]);
  });

  it("detects docker-compose.yml", () => {
    const tree: RepositoryTree = { entries: [blob("docker-compose.yml")], truncated: false };
    const result = analyzeDocker(tree);

    expect(result.composePresent).toBe(true);
    expect(result.composePaths).toEqual(["docker-compose.yml"]);
  });

  it("detects compose.yml", () => {
    const tree: RepositoryTree = { entries: [blob("compose.yml")], truncated: false };
    const result = analyzeDocker(tree);

    expect(result.composePresent).toBe(true);
  });

  it("reports absence when neither is present", () => {
    const tree: RepositoryTree = { entries: [blob("README.md"), blob("src/index.ts")], truncated: false };
    const result = analyzeDocker(tree);

    expect(result.dockerfilePresent).toBe(false);
    expect(result.composePresent).toBe(false);
    expect(result.dockerfilePaths).toEqual([]);
    expect(result.composePaths).toEqual([]);
  });

  it("detects a Dockerfile nested in a subdirectory", () => {
    const tree: RepositoryTree = { entries: [blob("docker/Dockerfile")], truncated: false };
    const result = analyzeDocker(tree);
    expect(result.dockerfilePresent).toBe(true);
  });
});
