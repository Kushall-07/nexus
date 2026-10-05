import { describe, expect, it } from "vitest";
import { parsePyprojectToml } from "../../../src/analyzer/dependency/pyproject-toml.js";
import { loadTechnologyConfig } from "../../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("parsePyprojectToml", () => {
  it("parses [project] dependencies", () => {
    const content = `
[project]
name = "demo"
dependencies = [
  "fastapi>=0.100",
  "requests",
]
`;
    const result = parsePyprojectToml(content, "pyproject.toml", config);

    expect(result.warnings).toEqual([]);
    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "fastapi", technology: "fastapi", versionConstraint: ">=0.100", dependencyType: "runtime" }),
      expect.objectContaining({ packageName: "requests", technology: null, dependencyType: "runtime" }),
    ]);
  });

  it("parses [project.optional-dependencies] groups", () => {
    const content = `
[project]
name = "demo"
dependencies = []

[project.optional-dependencies]
test = ["pytest>=7.0"]
`;
    const result = parsePyprojectToml(content, "pyproject.toml", config);
    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "pytest", dependencyType: "optional" }),
    ]);
  });

  it("parses legacy Poetry-style tables", () => {
    const content = `
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.100"
django = { version = "^4.0" }
`;
    const result = parsePyprojectToml(content, "pyproject.toml", config);

    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "django", technology: "django", versionConstraint: "^4.0" }),
      expect.objectContaining({ packageName: "fastapi", technology: "fastapi", versionConstraint: "^0.100" }),
    ]);
  });

  it("returns a structured parse failure for malformed TOML instead of crashing", () => {
    const result = parsePyprojectToml("[project\nthis is not valid toml", "pyproject.toml", config);

    expect(result.dependencies).toEqual([]);
    expect(result.warnings).toEqual([
      { code: "MALFORMED_MANIFEST", path: "pyproject.toml", message: expect.any(String) },
    ]);
  });

  it("handles a pyproject.toml with no dependency sections at all", () => {
    const result = parsePyprojectToml('[project]\nname = "demo"\n', "pyproject.toml", config);
    expect(result.dependencies).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
