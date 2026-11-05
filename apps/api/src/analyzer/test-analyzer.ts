import type { TechnologyConfig } from "./technology-config.js";
import { extensionOf, isInExcludedDirectory } from "./path-utils.js";
import type {
  DependencyObservation,
  RepositoryTree,
  TestFrameworkObservation,
  TestObservation,
  TestTechnologySignal,
} from "./types.js";

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".go", ".java", ".rb", ".php",
  ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".kt", ".kts", ".swift", ".rs", ".scala",
]);

const TEST_DIRECTORY_SEGMENTS = new Set(["test", "tests", "__tests__"]);

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extensionOf(path)) && !isInExcludedDirectory(path);
}

function isTestFile(path: string): boolean {
  if (!isSourceFile(path)) {
    return false;
  }

  const lower = path.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;
  const directorySegments = lower.split("/").slice(0, -1);

  if (directorySegments.some((segment) => TEST_DIRECTORY_SEGMENTS.has(segment))) {
    return true;
  }

  return /\.(test|spec)\./.test(basename);
}

const INTEGRATION_DIRECTORY_SEGMENTS = new Set([
  "integration",
  "integration-tests",
  "integration_tests",
  "integrationtests",
]);

// Only files that already count as tests can be integration tests, so this is
// a strict subset of the generic test files and never widens the unit-test
// definition. Library-style names such as `src/integrations/slack.ts` are not
// tests and never match.
function isIntegrationTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  const basename = segments[segments.length - 1] ?? lower;

  if (segments.slice(0, -1).some((segment) => INTEGRATION_DIRECTORY_SEGMENTS.has(segment))) {
    return true;
  }

  return /(^|[._-])integration([._-]|$)/.test(basename);
}

function detectTestFrameworks(
  dependencies: DependencyObservation[],
  config: TechnologyConfig,
): TestFrameworkObservation[] {
  const found = new Map<string, TestFrameworkObservation>();

  for (const framework of config.testFrameworks ?? []) {
    for (const dependency of dependencies) {
      const configured = framework.dependencyIdentifiers[dependency.source];

      if (!configured) {
        continue;
      }

      const name = dependency.packageName.toLowerCase();
      const matches = configured.some((identifier) =>
        dependency.source === "pom.xml"
          ? name.includes(identifier.toLowerCase())
          : name === identifier.toLowerCase(),
      );

      if (matches) {
        found.set(`${framework.id}|${dependency.sourcePath}`, {
          framework: framework.id,
          displayName: framework.displayName,
          sourcePath: dependency.sourcePath,
        });
      }
    }
  }

  return Array.from(found.values()).sort(
    (a, b) =>
      a.framework.localeCompare(b.framework) || a.sourcePath.localeCompare(b.sourcePath),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRelevantToTechnology(
  path: string,
  technologyId: string,
  sourceFileExtensions: string[],
): boolean {
  if (sourceFileExtensions.includes(extensionOf(path))) {
    return true;
  }

  const wordBoundaryPattern = new RegExp(`\\b${escapeRegExp(technologyId)}\\b`, "i");
  return wordBoundaryPattern.test(path);
}

export function analyzeTests(
  tree: RepositoryTree,
  relevantTechnologyIds: string[],
  config: TechnologyConfig,
  dependencies: DependencyObservation[] = [],
): TestObservation {
  const testFilePaths: string[] = [];
  let sourceFileCount = 0;

  for (const entry of tree.entries) {
    if (entry.type !== "blob") {
      continue;
    }

    if (isSourceFile(entry.path)) {
      sourceFileCount += 1;
    }

    if (isTestFile(entry.path)) {
      testFilePaths.push(entry.path);
    }
  }

  testFilePaths.sort();
  const testFileCount = testFilePaths.length;

  const integrationTestFilePaths = testFilePaths.filter(isIntegrationTestFile);

  const testRatio = sourceFileCount > 0 ? testFileCount / sourceFileCount : 0;
  const genericTestSignal = sourceFileCount > 0 ? Math.min(testRatio / 0.2, 1) : 0;

  const perTechnology: TestTechnologySignal[] = [];

  for (const technologyId of [...relevantTechnologyIds].sort()) {
    const definition = config.technologies.find((item) => item.id === technologyId);
    const extensions = definition?.sourceFileExtensions ?? [];

    const skillReferencedTestFiles = testFilePaths.filter((path) =>
      isRelevantToTechnology(path, technologyId, extensions),
    ).length;

    perTechnology.push({
      technology: technologyId,
      skillReferencedTestFiles,
      skillSpecificTestSignal: Math.min(skillReferencedTestFiles / 3, 1),
    });
  }

  return {
    testFileCount,
    sourceFileCount,
    testFilePaths,
    testRatio,
    genericTestSignal,
    perTechnology,
    integrationTestFilePaths,
    integrationTestSignal: Math.min(integrationTestFilePaths.length / 3, 1),
    testFrameworks: detectTestFrameworks(dependencies, config),
  };
}
