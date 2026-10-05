// Repository files are untrusted input. This module is the single place that
// decides whether a fetched file is safe to treat as text, and provides
// defensive parsers that can never throw into analyzer code. Nothing here
// ever executes, evaluates, or installs repository-controlled content.

export const MAX_PARSED_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".jar", ".war",
  ".mp3", ".mp4", ".mov", ".avi", ".mkv", ".wav", ".flac",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pyc", ".o", ".a", ".wasm",
]);

export function hasBinaryExtension(path: string): boolean {
  const lower = path.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");

  if (dotIndex === -1) {
    return false;
  }

  return BINARY_EXTENSIONS.has(lower.slice(dotIndex));
}

// Heuristic binary detection for content whose extension didn't already rule
// it out: a NUL byte in the first chunk is a reliable signal that the
// content is not text, without needing to scan the whole file.
export function looksBinary(content: string): boolean {
  const sampleLength = Math.min(content.length, 8000);

  for (let i = 0; i < sampleLength; i += 1) {
    if (content.charCodeAt(i) === 0) {
      return true;
    }
  }

  return false;
}

export function exceedsSizeLimit(size: number | null): boolean {
  return size !== null && size > MAX_PARSED_FILE_SIZE_BYTES;
}

export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export function safeParseJson<T = unknown>(content: string): SafeParseResult<T> {
  try {
    return { ok: true, data: JSON.parse(content) as T };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Invalid JSON" };
  }
}
