import { describe, expect, it } from "vitest";
import {
  MAX_PARSED_FILE_SIZE_BYTES,
  exceedsSizeLimit,
  hasBinaryExtension,
  looksBinary,
  safeParseJson,
} from "../../src/analyzer/file-safety.js";

describe("file safety", () => {
  it("flags files over the 1MB limit", () => {
    expect(exceedsSizeLimit(MAX_PARSED_FILE_SIZE_BYTES + 1)).toBe(true);
    expect(exceedsSizeLimit(MAX_PARSED_FILE_SIZE_BYTES)).toBe(false);
    expect(exceedsSizeLimit(null)).toBe(false);
  });

  it("detects binary files by extension", () => {
    expect(hasBinaryExtension("logo.png")).toBe(true);
    expect(hasBinaryExtension("archive.zip")).toBe(true);
    expect(hasBinaryExtension("src/index.ts")).toBe(false);
    expect(hasBinaryExtension("no-extension-file")).toBe(false);
  });

  it("detects binary content via a NUL byte heuristic", () => {
    expect(looksBinary("plain text content")).toBe(false);
    expect(looksBinary("binary\0content")).toBe(true);
  });

  it("safely parses valid JSON", () => {
    const result = safeParseJson<{ a: number }>('{"a": 1}');
    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("never throws on malformed JSON, returning a structured failure instead", () => {
    const result = safeParseJson("{not valid json");
    expect(result.ok).toBe(false);
  });
});
