import type { ActivityObservation } from "./types.js";

// The bounded recent-activity window: commit activity is evaluated only
// within the last N days, matching the single bounded `since`-filtered
// GitHub request the fetcher makes (no unbounded history crawl).
export const ACTIVITY_WINDOW_DAYS = 90;
export const COMMIT_PAGE_SIZE = 100;

export interface CommitActivityInput {
  commitDates: string[]; // ISO 8601 timestamps, as returned by GitHub
  pageSizeReached: boolean;
}

function toUtcDateKey(isoDate: string): string | null {
  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function analyzeActivity(
  input: CommitActivityInput,
  now: Date = new Date(),
): ActivityObservation {
  const sinceDate = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const activeDayKeys = new Set<string>();
  let recentCommitCount = 0;

  for (const isoDate of input.commitDates) {
    const dateKey = toUtcDateKey(isoDate);

    if (!dateKey) {
      continue;
    }

    recentCommitCount += 1;
    activeDayKeys.add(dateKey);
  }

  const recentCommitSignal = Math.min(recentCommitCount / 20, 1);
  const activeDaySignal = Math.min(activeDayKeys.size / 10, 1);

  return {
    recentCommitCount,
    activeDays: activeDayKeys.size,
    recentCommitSignal,
    activeDaySignal,
    activity: 0.5 * recentCommitSignal + 0.5 * activeDaySignal,
    windowDays: ACTIVITY_WINDOW_DAYS,
    sinceDate: sinceDate.toISOString(),
    bounded: input.pageSizeReached,
  };
}
