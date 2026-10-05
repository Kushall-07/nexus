import type { TechnologyConfig } from "./technology-config.js";
import { extensionOf, isInExcludedDirectory } from "./path-utils.js";
import type { RepositoryTree, TestObservation, TestTechnologySignal } from "./types.js";

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
  };
}
