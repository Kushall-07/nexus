import type { RepositoryAnalysis } from "../../src/analyzer/types.js";

export const USER_ID = "507f1f77bcf86cd799439001";
export const REPOSITORY_ID = "507f1f77bcf86cd799439011";
export const DETECTED_AT = new Date("2026-01-15T12:00:00.000Z");

export function emptyAnalysis(overrides: Partial<RepositoryAnalysis> = {}): RepositoryAnalysis {
  return {
    repositoryId: REPOSITORY_ID,
    repositoryFullName: "octocat/demo",
    analyzedAt: DETECTED_AT.toISOString(),
    languages: { bytesByLanguage: {}, percentageByLanguage: {}, totalBytes: 0 },
    dependencies: [],
    frameworks: [],
    sourceUsage: [],
    projectStructure: [
      { category: "frontend", detectedPaths: [], relevantStructureSignalCount: 0 },
      { category: "backend", detectedPaths: [], relevantStructureSignalCount: 0 },
      { category: "ml", detectedPaths: [], relevantStructureSignalCount: 0 },
      { category: "ai", detectedPaths: [], relevantStructureSignalCount: 0 },
    ],
    docker: { dockerfilePresent: false, composePresent: false, dockerfilePaths: [], composePaths: [] },
    testing: {
      testFileCount: 0,
      sourceFileCount: 0,
      testFilePaths: [],
      testRatio: 0,
      genericTestSignal: 0,
      perTechnology: [],
    },
    documentation: { readmePresent: false, readmePath: null, readmeSize: null, perTechnology: [] },
    activity: {
      recentCommitCount: 0,
      activeDays: 0,
      recentCommitSignal: 0,
      activeDaySignal: 0,
      activity: 0,
      windowDays: 90,
      sinceDate: "2025-10-17T12:00:00.000Z",
      bounded: false,
    },
    requestBudget: { limit: 10, used: 3, remaining: 7 },
    warnings: [],
    ...overrides,
  };
}

// A representative React + FastAPI + Docker repository with every observation kind.
export function richAnalysis(): RepositoryAnalysis {
  return emptyAnalysis({
    languages: {
      bytesByLanguage: { TypeScript: 6500, Python: 3000, CSS: 500 },
      percentageByLanguage: { TypeScript: 65, Python: 30, CSS: 5 },
      totalBytes: 10000,
    },
    dependencies: [
      {
        packageName: "react",
        technology: "react",
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: "^18.0.0",
      },
      {
        packageName: "fastapi",
        technology: "fastapi",
        source: "requirements.txt",
        sourcePath: "backend/requirements.txt",
        dependencyType: "unknown",
        versionConstraint: null,
      },
      {
        packageName: "django",
        technology: "django",
        source: "requirements.txt",
        sourcePath: "legacy/requirements.txt",
        dependencyType: "unknown",
        versionConstraint: null,
      },
      {
        packageName: "left-pad",
        technology: null,
        source: "package.json",
        sourcePath: "package.json",
        dependencyType: "runtime",
        versionConstraint: null,
      },
    ],
    frameworks: [
      {
        technology: "react",
        displayName: "React",
        evidence: [
          { type: "source", sourcePath: "src/App.tsx", sourceReference: "import React from \"react\"" },
          { type: "dependency", sourcePath: "package.json", sourceReference: "runtime:react" },
        ],
      },
      {
        technology: "django",
        displayName: "Django",
        evidence: [{ type: "config", sourcePath: "manage.py", sourceReference: "manage.py" }],
      },
    ],
    sourceUsage: [
      {
        technology: "react",
        displayName: "React",
        importReferenceCount: 3,
        relevantSourceFileCount: 2,
        importSignal: 1,
        fileUsageSignal: 0.2,
        sourceUsage: 0.68,
        relevantSourceFilePaths: ["src/App.tsx", "src/components/Dashboard.tsx"],
        sampledSourceFilePaths: ["src/App.tsx", "src/components/Dashboard.tsx"],
        bounded: true,
      },
      {
        technology: "fastapi",
        displayName: "FastAPI",
        importReferenceCount: 0,
        relevantSourceFileCount: 0,
        importSignal: 0,
        fileUsageSignal: 0,
        sourceUsage: 0,
        relevantSourceFilePaths: [],
        sampledSourceFilePaths: [],
        bounded: false,
      },
    ],
    projectStructure: [
      {
        category: "frontend",
        detectedPaths: ["src", "src/components"],
        relevantStructureSignalCount: 2,
      },
      { category: "backend", detectedPaths: [], relevantStructureSignalCount: 0 },
      { category: "ml", detectedPaths: [], relevantStructureSignalCount: 0 },
      { category: "ai", detectedPaths: [], relevantStructureSignalCount: 0 },
    ],
    docker: {
      dockerfilePresent: true,
      composePresent: true,
      dockerfilePaths: ["Dockerfile"],
      composePaths: ["deploy/docker-compose.yml"],
    },
    testing: {
      testFileCount: 4,
      sourceFileCount: 20,
      testFilePaths: ["src/App.test.tsx", "tests/api.test.py"],
      testRatio: 0.2,
      genericTestSignal: 1,
      perTechnology: [
        { technology: "react", skillReferencedTestFiles: 2, skillSpecificTestSignal: 2 / 3 },
        { technology: "fastapi", skillReferencedTestFiles: 0, skillSpecificTestSignal: 0 },
      ],
    },
    documentation: {
      readmePresent: true,
      readmePath: "README.md",
      readmeSize: 900,
      perTechnology: [
        { technology: "react", skillMention: true, documentationSignal: 1 },
        { technology: "fastapi", skillMention: false, documentationSignal: 0.5 },
      ],
    },
    activity: {
      recentCommitCount: 10,
      activeDays: 5,
      recentCommitSignal: 0.5,
      activeDaySignal: 0.5,
      activity: 0.5,
      windowDays: 90,
      sinceDate: "2025-10-17T12:00:00.000Z",
      bounded: false,
    },
  });
}
