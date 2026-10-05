// Shared, pure path helpers used across analyzers so "what counts as a
// directory to exclude" / "what is this file's extension" stays consistent
// everywhere it matters (test detection, source sampling, docker detection).

export const EXCLUDED_DIRECTORY_SEGMENTS = new Set([
  "node_modules", "vendor", "dist", "build", ".next", "target", "bin", "obj",
]);

export function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function extensionOf(path: string): string {
  const name = basename(path);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex === -1 ? "" : name.slice(dotIndex).toLowerCase();
}

export function isInExcludedDirectory(path: string): boolean {
  const segments = path.toLowerCase().split("/");
  return segments.some((segment) => EXCLUDED_DIRECTORY_SEGMENTS.has(segment));
}

export function pathDepth(path: string): number {
  return path.split("/").length;
}
