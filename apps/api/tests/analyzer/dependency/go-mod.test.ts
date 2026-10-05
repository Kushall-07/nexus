import { describe, expect, it } from "vitest";
import { parseGoMod } from "../../../src/analyzer/dependency/go-mod.js";
import { loadTechnologyConfig } from "../../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("parseGoMod", () => {
  it("parses a single require declaration", () => {
    const content = `module github.com/example/project

go 1.21

require github.com/gin-gonic/gin v1.9.1
`;
    const result = parseGoMod(content, "go.mod", config);

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        packageName: "github.com/gin-gonic/gin",
        technology: "gin",
        versionConstraint: "v1.9.1",
        dependencyType: "runtime",
      }),
    ]);
  });

  it("parses a require block with multiple entries", () => {
    const content = `module github.com/example/project

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stretchr/testify v1.8.0 // indirect
)
`;
    const result = parseGoMod(content, "go.mod", config);

    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "github.com/gin-gonic/gin", dependencyType: "runtime" }),
      expect.objectContaining({ packageName: "github.com/stretchr/testify", dependencyType: "unknown" }),
    ]);
  });

  it("extracts no dependencies from a module with only a module/go directive", () => {
    const result = parseGoMod("module github.com/example/empty\n\ngo 1.21\n", "go.mod", config);
    expect(result.dependencies).toEqual([]);
  });

  it("never throws on malformed input", () => {
    expect(() => parseGoMod("!!! not a go.mod file at all ???", "go.mod", config)).not.toThrow();
    const result = parseGoMod("!!! not a go.mod file at all ???", "go.mod", config);
    expect(result.dependencies).toEqual([]);
  });

  it("deduplicates repeated requires", () => {
    const content = `require (
    github.com/gin-gonic/gin v1.9.1
    github.com/gin-gonic/gin v1.9.1
)
`;
    const result = parseGoMod(content, "go.mod", config);
    expect(result.dependencies).toHaveLength(1);
  });
});
