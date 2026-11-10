// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { aggregateLanguages } from "./languages";

describe("aggregateLanguages", () => {
  it("weights by bytes, not by repository", () => {
    const mix = aggregateLanguages([
      { languages: { TypeScript: 900, CSS: 100 } }, // large repo, mostly TypeScript
      { languages: { Python: 100 } }, // small repo, all Python
    ]);

    const by = Object.fromEntries(mix.shares.map((s) => [s.name, s.pct]));
    expect(mix.totalBytes).toBe(1100);
    expect(by.TypeScript).toBeCloseTo((900 / 1100) * 100, 6); // ≈ 81.8, an average of percentages would say 45
    expect(by.Python).toBeCloseTo((100 / 1100) * 100, 6); // ≈ 9.1, an average would say 50
    expect(by.CSS).toBeCloseTo((100 / 1100) * 100, 6);
    expect(mix.repositoriesCounted).toBe(2);
  });

  it("always sums to 100% of the counted bytes", () => {
    const mix = aggregateLanguages([
      { languages: { A: 7, B: 5, C: 3, D: 2, E: 1, F: 1, G: 1, H: 1, I: 1 } },
      { languages: { A: 11, J: 2 } },
    ]);
    let sum = 0;
    for (const share of mix.shares) sum += share.pct;
    expect(sum).toBeCloseTo(100, 6);
  });

  it("sorts largest first and breaks ties by name", () => {
    const mix = aggregateLanguages([{ languages: { Zig: 10, Ada: 10, Go: 30 } }]);
    expect(mix.shares.map((s) => s.name)).toEqual(["Go", "Ada", "Zig"]);
  });

  it("folds the long tail into a single Other entry with the combined bytes", () => {
    const languages: Record<string, number> = {};
    for (let i = 1; i <= 9; i++) languages[`L${i}`] = 100 - i * 5; // 95 … 55, all different
    const mix = aggregateLanguages([{ languages }], 6);

    expect(mix.shares).toHaveLength(7);
    const other = mix.shares[6]!;
    expect(other.name).toBe("Other");
    expect(other.bytes).toBe(languages.L7! + languages.L8! + languages.L9!);
    expect(other.pct).toBeCloseTo((other.bytes / mix.totalBytes) * 100, 6);
  });

  it("drops a folded tail too small to be visible", () => {
    const mix = aggregateLanguages([{ languages: { Big: 100000, A: 1, B: 1 } }], 1);
    expect(mix.shares.map((s) => s.name)).toEqual(["Big"]);
  });

  it("leaves repositories without byte data out and reports how many", () => {
    const mix = aggregateLanguages([
      { languages: { Python: 50 } },
      { languages: null },
      {},
      { languages: {} },
      { languages: { Go: 0 } },
    ]);
    expect(mix.repositoriesCounted).toBe(1);
    expect(mix.repositoriesWithoutData).toBe(4);
    expect(mix.shares).toEqual([{ name: "Python", bytes: 50, pct: 100 }]);
  });

  it("ignores invalid byte values instead of corrupting the totals", () => {
    const mix = aggregateLanguages([{ languages: { Good: 10, Neg: -5, NaN: Number.NaN, Inf: Number.POSITIVE_INFINITY, Str: "7" as unknown as number } }]);
    expect(mix.totalBytes).toBe(10);
    expect(mix.shares).toEqual([{ name: "Good", bytes: 10, pct: 100 }]);
  });

  it("returns an empty mix when there is no data at all", () => {
    expect(aggregateLanguages([])).toEqual({ shares: [], totalBytes: 0, repositoriesCounted: 0, repositoriesWithoutData: 0 });
    expect(aggregateLanguages([{ languages: null }, {}]).repositoriesWithoutData).toBe(2);
  });
});
