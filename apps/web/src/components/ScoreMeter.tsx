import { formatScore } from "../lib/format";

// Displays a backend-provided Evidence Score. A null score means none exists
// and is never rendered as 0.
export function ScoreMeter({ score, unavailableLabel }: { score: number | null; unavailableLabel: string }) {
  if (score === null) {
    return <span className="text-sm text-slate-600">{unavailableLabel}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Evidence Score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(formatScore(score))}
        className="h-2 w-24 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full bg-indigo-700" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-900">{formatScore(score)}/100</span>
    </div>
  );
}

export function unavailableLabel(status: "not-analyzed" | "no-evidence" | "scored"): string {
  return status === "not-analyzed" ? "Not yet analyzed" : "No evidence available";
}
