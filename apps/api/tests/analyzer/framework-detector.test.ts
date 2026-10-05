import { describe, expect, it } from "vitest";
import { detectFrameworks } from "../../src/analyzer/framework-detector.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";
import type { DependencyObservation, RepositoryTree } from "../../src/analyzer/types.js";

const config = loadTechnologyConfig();

function dep(overrides: Partial<DependencyObservation>): DependencyObservation {
  return {
    packageName: "react",
    technology: "react",
    source: "package.json",
    sourcePath: "package.json",
    dependencyType: "runtime",
    versionConstraint: null,
    ...overrides,
  };
}

const emptyTree: RepositoryTree = { entries: [], truncated: false };

describe("detectFrameworks", () => {
  it("detects a framework from dependency + source usage evidence", () => {
    const frameworks = detectFrameworks(
      {
        dependencies: [dep({})],
        tree: emptyTree,
        sampledFiles: [{ path: "src/App.tsx", content: "import React from 'react';" }],
      },
      config,
    );

    const react = frameworks.find((f) => f.technology === "react");
    expect(react).toBeDefined();
    expect(react?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "dependency" }),
        expect.objectContaining({ type: "source", sourceReference: "import React from 'react';" }),
      ]),
    );
  });

  it("detects a framework from dependency evidence alone", () => {
    const frameworks = detectFrameworks(
      { dependencies: [dep({ packageName: "express", technology: "express" })], tree: emptyTree, sampledFiles: [] },
      config,
    );

    expect(frameworks.map((f) => f.technology)).toContain("express");
  });

  it("does NOT detect a framework from language presence alone", () => {
    // No dependency, no config file, no matching source content — only a
    // Python file existing in the tree, which is not evidence of FastAPI.
    const frameworks = detectFrameworks(
      {
        dependencies: [],
        tree: { entries: [{ path: "app.py", type: "blob", size: 100, sha: "abc" }], truncated: false },
        sampledFiles: [{ path: "app.py", content: "print('hello world')" }],
      },
      config,
    );

    expect(frameworks.map((f) => f.technology)).not.toContain("fastapi");
    expect(frameworks).toEqual([]);
  });

  it("detects Next.js from its config file pattern", () => {
    const frameworks = detectFrameworks(
      {
        dependencies: [],
        tree: { entries: [{ path: "next.config.js", type: "blob", size: 50, sha: "x" }], truncated: false },
        sampledFiles: [],
      },
      config,
    );

    const nextjs = frameworks.find((f) => f.technology === "nextjs");
    expect(nextjs?.evidence).toEqual([
      { type: "config", sourcePath: "next.config.js", sourceReference: "next.config.js" },
    ]);
  });

  it("detects FastAPI from dependency + source usage", () => {
    const frameworks = detectFrameworks(
      {
        dependencies: [dep({ packageName: "fastapi", technology: "fastapi", source: "requirements.txt" })],
        tree: emptyTree,
        sampledFiles: [{ path: "main.py", content: "from fastapi import FastAPI" }],
      },
      config,
    );

    expect(frameworks.find((f) => f.technology === "fastapi")?.evidence.length).toBeGreaterThan(0);
  });

  it("produces deterministic, sorted output", () => {
    const frameworks = detectFrameworks(
      {
        dependencies: [
          dep({ packageName: "express", technology: "express" }),
          dep({ packageName: "react", technology: "react" }),
        ],
        tree: emptyTree,
        sampledFiles: [],
      },
      config,
    );

    expect(frameworks.map((f) => f.technology)).toEqual(["express", "react"]);
  });
});
