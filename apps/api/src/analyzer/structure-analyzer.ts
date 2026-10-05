import type { TechnologyConfig } from "./technology-config.js";
import type { RepositoryTree, StructureCategory, StructureObservation } from "./types.js";

const CATEGORY_ORDER: StructureCategory[] = ["frontend", "backend", "ml", "ai"];

// Every directory segment that appears anywhere in the tree, derived from
// blob paths (GitHub's recursive tree listing does not reliably include an
// entry for every intermediate directory, so directories are inferred from
// file paths rather than relying on `type: "tree"` entries alone).
function collectDirectorySegments(tree: RepositoryTree): Map<string, string> {
  const directories = new Map<string, string>(); // segment name -> first full path seen

  for (const entry of tree.entries) {
    const segments = entry.path.split("/");
    const relevantSegments = entry.type === "blob" ? segments.slice(0, -1) : segments;

    let currentPath = "";

    for (const segment of relevantSegments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const key = segment.toLowerCase();

      if (!directories.has(key)) {
        directories.set(key, currentPath);
      }
    }
  }

  return directories;
}

export function analyzeStructure(
  tree: RepositoryTree,
  config: TechnologyConfig,
): StructureObservation[] {
  const directorySegments = collectDirectorySegments(tree);
  const observations: StructureObservation[] = [];

  for (const category of CATEGORY_ORDER) {
    const patterns = config.structureCategories[category] ?? [];
    const matchedPatternNames = new Set<string>();
    const detectedPaths = new Set<string>();

    for (const pattern of patterns) {
      const fullPath = directorySegments.get(pattern.toLowerCase());

      if (fullPath) {
        matchedPatternNames.add(pattern.toLowerCase());
        detectedPaths.add(fullPath);
      }
    }

    observations.push({
      category,
      detectedPaths: Array.from(detectedPaths).sort(),
      relevantStructureSignalCount: matchedPatternNames.size,
    });
  }

  return observations;
}
