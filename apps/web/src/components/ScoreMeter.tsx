import { formatScore } from "../lib/format";

// Displays a backend-provided Evidence Score. A null score means none exists
// and is never rendered as 0.
export function ScoreMeter({ score, unavailableLabel }: { score: number | null; unavailableLabel: string }) {
  if (score === null) {
    return <span className="text-sm text-slate-500">{unavailableLabel}</span>;
  }

  const pct = Math.min(100, Math.max(0, score));
  const formatted = formatScore(score);

  // Gold fill for strong evidence; amber for mid; red for low
  const fillClass = pct >= 60 ? "nx-score-fill" : pct >= 30 ? "bg-amber-500" : "bg-red-400";

  return (
    <div className="flex items-center gap-2.5">
      <div
        role="meter"
        aria-label="Evidence Score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(formatted)}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${pct}%`, transition: "width 0.4s ease-out" }}
        />
      </div>
      <span className="tabular-nums text-sm font-semibold text-slate-800">{formatted}/100</span>
    </div>
  );
}

export function unavailableLabel(status: "not-analyzed" | "no-evidence" | "scored"): string {
  return status === "not-analyzed" ? "Not yet analyzed" : "No evidence available";
}
