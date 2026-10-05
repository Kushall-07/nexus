import { describe, expect, it } from "vitest";
import { analyzeActivity } from "../../src/analyzer/activity-analyzer.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("analyzeActivity", () => {
  it("handles zero commits", () => {
    const result = analyzeActivity({ commitDates: [], pageSizeReached: false }, NOW);

    expect(result.recentCommitCount).toBe(0);
    expect(result.activeDays).toBe(0);
    expect(result.recentCommitSignal).toBe(0);
    expect(result.activeDaySignal).toBe(0);
    expect(result.activity).toBe(0);
  });

  it("handles a single commit", () => {
    const result = analyzeActivity({ commitDates: [isoDaysAgo(1)], pageSizeReached: false }, NOW);

    expect(result.recentCommitCount).toBe(1);
    expect(result.activeDays).toBe(1);
    expect(result.recentCommitSignal).toBeCloseTo(1 / 20);
    expect(result.activeDaySignal).toBeCloseTo(1 / 10);
  });

  it("saturates recentCommitSignal at exactly 20 commits", () => {
    const commitDates = Array.from({ length: 20 }, (_, i) => isoDaysAgo(i));
    const result = analyzeActivity({ commitDates, pageSizeReached: false }, NOW);

    expect(result.recentCommitCount).toBe(20);
    expect(result.recentCommitSignal).toBe(1);
  });

  it("remains bounded at 1 for more than 20 commits", () => {
    const commitDates = Array.from({ length: 35 }, (_, i) => isoDaysAgo(0));
    const result = analyzeActivity({ commitDates, pageSizeReached: true }, NOW);

    expect(result.recentCommitCount).toBe(35);
    expect(result.recentCommitSignal).toBe(1);
  });

  it("saturates activeDaySignal at exactly 10 active days", () => {
    const commitDates = Array.from({ length: 10 }, (_, i) => isoDaysAgo(i));
    const result = analyzeActivity({ commitDates, pageSizeReached: false }, NOW);

    expect(result.activeDays).toBe(10);
    expect(result.activeDaySignal).toBe(1);
  });

  it("remains bounded at 1 for more than 10 active days", () => {
    const commitDates = Array.from({ length: 15 }, (_, i) => isoDaysAgo(i));
    const result = analyzeActivity({ commitDates, pageSizeReached: false }, NOW);

    expect(result.activeDays).toBe(15);
    expect(result.activeDaySignal).toBe(1);
  });

  it("computes the combined activity formula exactly", () => {
    const commitDates = Array.from({ length: 10 }, (_, i) => isoDaysAgo(i));
    const result = analyzeActivity({ commitDates, pageSizeReached: false }, NOW);

    const expected = 0.5 * Math.min(10 / 20, 1) + 0.5 * Math.min(10 / 10, 1);
    expect(result.activity).toBeCloseTo(expected);
  });

  it("never produces NaN or a value outside [0, 1]", () => {
    const result = analyzeActivity({ commitDates: [], pageSizeReached: false }, NOW);
    expect(Number.isFinite(result.activity)).toBe(true);
    expect(result.activity).toBeGreaterThanOrEqual(0);
    expect(result.activity).toBeLessThanOrEqual(1);
  });

  it("ignores malformed commit date strings without crashing", () => {
    const result = analyzeActivity(
      { commitDates: ["not-a-date", isoDaysAgo(1)], pageSizeReached: false },
      NOW,
    );
    expect(result.recentCommitCount).toBe(1);
  });

  it("propagates the bounded flag from pageSizeReached", () => {
    const result = analyzeActivity({ commitDates: [], pageSizeReached: true }, NOW);
    expect(result.bounded).toBe(true);
  });

  it("deduplicates commits on the same day into a single active day", () => {
    const sameDayMorning = isoDaysAgo(1);
    const sameDayEvening = new Date(new Date(sameDayMorning).getTime() + 3600_000).toISOString();
    const result = analyzeActivity(
      { commitDates: [sameDayMorning, sameDayEvening], pageSizeReached: false },
      NOW,
    );

    expect(result.recentCommitCount).toBe(2);
    expect(result.activeDays).toBe(1);
  });
});
