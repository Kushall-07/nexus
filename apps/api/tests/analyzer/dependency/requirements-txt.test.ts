import { describe, expect, it } from "vitest";
import { parseRequirementsTxt } from "../../../src/analyzer/dependency/requirements-txt.js";
import { loadTechnologyConfig } from "../../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("parseRequirementsTxt", () => {
  it("parses simple unpinned dependencies", () => {
    const result = parseRequirementsTxt("fastapi\ntorch\n", "requirements.txt", config);

    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "fastapi", technology: "fastapi", versionConstraint: null }),
      expect.objectContaining({ packageName: "torch", technology: null, versionConstraint: null }),
    ]);
  });

  it("parses pinned versions", () => {
    const result = parseRequirementsTxt("fastapi==0.110.0\n", "requirements.txt", config);
    expect(result.dependencies[0]).toMatchObject({
      packageName: "fastapi",
      versionConstraint: "==0.110.0",
    });
  });

  it("parses version constraint operators", () => {
    const result = parseRequirementsTxt(
      "numpy>=1.2\ndjango<=4.0\nflask~=2.0\n",
      "requirements.txt",
      config,
    );

    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "django", versionConstraint: "<=4.0" }),
      expect.objectContaining({ packageName: "flask", versionConstraint: "~=2.0" }),
      expect.objectContaining({ packageName: "numpy", versionConstraint: ">=1.2" }),
    ]);
  });

  it("skips comments, blank lines, and editable/url directives without crashing", () => {
    const content = [
      "# a comment",
      "",
      "-e .",
      "-r other-requirements.txt",
      "fastapi==0.1",
    ].join("\n");

    const result = parseRequirementsTxt(content, "requirements.txt", config);
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].packageName).toBe("fastapi");
  });

  it("ignores extras and environment markers safely", () => {
    const result = parseRequirementsTxt(
      'fastapi[all]==0.1; python_version>="3.8"\n',
      "requirements.txt",
      config,
    );
    expect(result.dependencies[0]).toMatchObject({ packageName: "fastapi", versionConstraint: "==0.1" });
  });

  it("deduplicates repeated package names", () => {
    const result = parseRequirementsTxt("fastapi\nfastapi==0.2\n", "requirements.txt", config);
    expect(result.dependencies).toHaveLength(1);
  });

  it("never throws on malformed lines", () => {
    expect(() => parseRequirementsTxt("!!!not-a-valid-line###\n", "requirements.txt", config)).not.toThrow();
  });
});
