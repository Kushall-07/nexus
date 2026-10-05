import { describe, expect, it } from "vitest";
import { analyzeLanguages } from "../../src/analyzer/language-analyzer.js";

describe("analyzeLanguages", () => {
  it("normalizes raw byte counts into deterministic percentages", () => {
    const result = analyzeLanguages({
      TypeScript: 61000,
      Python: 28000,
      CSS: 7000,
      HTML: 4000,
    });

    expect(result.observations.percentageByLanguage).toEqual({
      TypeScript: 61,
      Python: 28,
      CSS: 7,
      HTML: 4,
    });
    expect(result.observations.totalBytes).toBe(100000);
    expect(result.warnings).toEqual([]);
  });

  it("handles an empty language response without crashing", () => {
    const result = analyzeLanguages({});

    expect(result.observations.bytesByLanguage).toEqual({});
    expect(result.observations.percentageByLanguage).toEqual({});
    expect(result.observations.totalBytes).toBe(0);
    expect(result.warnings).toEqual([
      { code: "NO_LANGUAGE_DATA", message: expect.any(String) },
    ]);
  });

  it("handles null/undefined input without crashing", () => {
    expect(analyzeLanguages(null).observations.totalBytes).toBe(0);
    expect(analyzeLanguages(undefined).observations.totalBytes).toBe(0);
  });

  it("handles a zero-total response without dividing by zero", () => {
    const result = analyzeLanguages({ TypeScript: 0 });

    expect(result.observations.percentageByLanguage).toEqual({});
    expect(result.warnings[0]?.code).toBe("NO_LANGUAGE_DATA");
  });

  it("ignores malformed/negative byte counts rather than crashing", () => {
    const result = analyzeLanguages({
      TypeScript: 1000,
      Weird: -5,
      // @ts-expect-error -- deliberately malformed input from an untrusted API
      Malformed: "not-a-number",
    });

    expect(result.observations.bytesByLanguage).toEqual({ TypeScript: 1000 });
    expect(result.observations.percentageByLanguage).toEqual({ TypeScript: 100 });
  });

  it("never produces a percentage above 100 or below 0", () => {
    const result = analyzeLanguages({ A: 1, B: 2, C: 3 });

    for (const percentage of Object.values(result.observations.percentageByLanguage)) {
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    }
  });
});
