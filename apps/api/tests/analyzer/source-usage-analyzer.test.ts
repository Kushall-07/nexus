import { describe, expect, it } from "vitest";
import { analyzeSourceUsage } from "../../src/analyzer/source-usage-analyzer.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("analyzeSourceUsage", () => {
  it("returns zero signals for zero imports and zero files", () => {
    const [react] = analyzeSourceUsage({ sampledFiles: [], bounded: false }, ["react"], config);

    expect(react).toMatchObject({
      importReferenceCount: 0,
      relevantSourceFileCount: 0,
      importSignal: 0,
      fileUsageSignal: 0,
      sourceUsage: 0,
    });
  });

  it("computes the exact formula for a partial match (1 import / 2 files)", () => {
    const sampledFiles = [
      { path: "src/App.tsx", content: `import React from 'react';` },
      { path: "src/Other.tsx", content: `import React from 'react';` },
    ];

    // Two files both reference react once each: 2 import occurrences, 2 files.
    const [react] = analyzeSourceUsage({ sampledFiles, bounded: false }, ["react"], config);

    expect(react.importReferenceCount).toBe(2);
    expect(react.relevantSourceFileCount).toBe(2);
    expect(react.importSignal).toBeCloseTo(2 / 3);
    expect(react.fileUsageSignal).toBeCloseTo(2 / 10);
    expect(react.sourceUsage).toBeCloseTo(0.6 * (2 / 3) + 0.4 * (2 / 10));
  });

  it("saturates at exactly imports=3 / files=10", () => {
    const sampledFiles = Array.from({ length: 10 }, (_, i) => ({
      path: `src/File${i}.tsx`,
      content: i < 3 ? `import React from 'react';` : `export const x = 1;`,
    }));

    const [react] = analyzeSourceUsage({ sampledFiles, bounded: false }, ["react"], config);

    expect(react.importReferenceCount).toBe(3);
    expect(react.relevantSourceFileCount).toBe(3);
    expect(react.importSignal).toBe(1);
    expect(react.fileUsageSignal).toBeCloseTo(0.3);
  });

  it("remains bounded at 1 even when imports and files exceed saturation points", () => {
    const sampledFiles = Array.from({ length: 15 }, (_, i) => ({
      path: `src/File${i}.tsx`,
      content: `import React from 'react'; import React from 'react';`,
    }));

    const [react] = analyzeSourceUsage({ sampledFiles, bounded: false }, ["react"], config);

    expect(react.importReferenceCount).toBe(30);
    expect(react.relevantSourceFileCount).toBe(15);
    expect(react.importSignal).toBe(1);
    expect(react.fileUsageSignal).toBe(1);
    expect(react.sourceUsage).toBe(1);
  });

  it("never produces a value outside [0, 1]", () => {
    const sampledFiles = Array.from({ length: 50 }, (_, i) => ({
      path: `src/File${i}.tsx`,
      content: `import React from 'react';`.repeat(10),
    }));

    const [react] = analyzeSourceUsage({ sampledFiles, bounded: true }, ["react"], config);

    expect(react.sourceUsage).toBeGreaterThanOrEqual(0);
    expect(react.sourceUsage).toBeLessThanOrEqual(1);
  });

  it("produces deterministic, sorted output across multiple technologies", () => {
    const sampledFiles = [
      { path: "app.py", content: "from fastapi import FastAPI" },
      { path: "main.go", content: `import "github.com/gin-gonic/gin"` },
    ];

    const result = analyzeSourceUsage(
      { sampledFiles, bounded: false },
      ["gin", "fastapi"],
      config,
    );

    expect(result.map((r) => r.technology)).toEqual(["fastapi", "gin"]);
  });

  it("only scans files with applicable extensions for a given technology", () => {
    const sampledFiles = [{ path: "notes.md", content: "import React from 'react';" }];

    const [react] = analyzeSourceUsage({ sampledFiles, bounded: false }, ["react"], config);

    expect(react.importReferenceCount).toBe(0);
    expect(react.relevantSourceFileCount).toBe(0);
  });

  it("propagates the bounded flag from the input", () => {
    const [react] = analyzeSourceUsage({ sampledFiles: [], bounded: true }, ["react"], config);
    expect(react.bounded).toBe(true);
  });
});
