import { describe, expect, it } from "vitest";
import { parsePackageJson } from "../../../src/analyzer/dependency/package-json.js";
import { loadTechnologyConfig } from "../../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("parsePackageJson", () => {
  it("normalizes runtime and dev dependencies with technology resolution", () => {
    const content = JSON.stringify({
      dependencies: { react: "^18.0.0", "react-router-dom": "^6.0.0", express: "^4.18.0" },
      devDependencies: { vitest: "^1.0.0" },
    });

    const result = parsePackageJson(content, "package.json", config);

    expect(result.warnings).toEqual([]);
    expect(result.dependencies).toEqual([
      {
        packageName: "express",
        technology: "express",
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: "^4.18.0",
      },
      {
        packageName: "react",
        technology: "react",
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: "^18.0.0",
      },
      {
        packageName: "react-router-dom",
        technology: null,
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: "^6.0.0",
      },
      {
        packageName: "vitest",
        technology: null,
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "dev",
        versionConstraint: "^1.0.0",
      },
    ]);
  });

  it("handles missing dependency sections without crashing", () => {
    const result = parsePackageJson("{}", "package.json", config);
    expect(result.dependencies).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("returns a structured warning for malformed JSON instead of throwing", () => {
    const result = parsePackageJson("{not valid json", "package.json", config);

    expect(result.dependencies).toEqual([]);
    expect(result.warnings).toEqual([
      {
        code: "MALFORMED_MANIFEST",
        path: "package.json",
        message: expect.any(String),
      },
    ]);
  });

  it("does not treat non-object dependency sections as dependencies", () => {
    const result = parsePackageJson(
      JSON.stringify({ dependencies: "not-an-object" }),
      "package.json",
      config,
    );
    expect(result.dependencies).toEqual([]);
  });

  it("handles optionalDependencies and peerDependencies", () => {
    const result = parsePackageJson(
      JSON.stringify({
        optionalDependencies: { fsevents: "^2.0.0" },
        peerDependencies: { next: "^14.0.0" },
      }),
      "package.json",
      config,
    );

    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "fsevents", dependencyType: "optional" }),
      expect.objectContaining({ packageName: "next", dependencyType: "peer", technology: "nextjs" }),
    ]);
  });
});
