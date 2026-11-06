import { useState } from "react";
import { ApiError, apiPost } from "../../api/client";
import type { EvidenceMeta, RefreshResult, RefreshState } from "../../api/career-types";
import { describeError } from "../../components/StateViews";
import { buttonClass } from "./jobParts";

interface Props {
  evidence: EvidenceMeta;
  refresh: RefreshState;
  onDone: () => void;
}

const when = (value: string | null) => (value ? new Date(value).toLocaleString() : "never");

// Re-runs the existing GitHub analysis + scoring. The previous profile stays
// in place if the refresh fails.
export function RefreshPanel({ evidence, refresh, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiPost<RefreshResult>("/api/career/refresh"));
      onDone();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    } finally {
      setBusy(false);
    }
  }

  const stale = (result ? result.profileIsStale : refresh.status === "failed") && evidence.hasGithubAnalysis;

  return (
    <section aria-label="GitHub profile status" className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">GitHub evidence</h2>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            evidence.hasGithubAnalysis
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-300 bg-slate-100 text-slate-600"
          }`}
        >
          <span aria-hidden="true">{evidence.hasGithubAnalysis ? "✓ " : "– "}</span>
          {evidence.hasGithubAnalysis ? "Analyzed" : "Not analyzed"}
        </span>
      </div>

      <p className="text-sm text-slate-600">
        {evidence.hasGithubAnalysis
          ? <>Last analysis: {when(evidence.githubAnalyzedAt)}.</>
          : "No analysis yet. Select repositories and run an analysis first."}
      </p>

      {stale ? (
        <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Your last refresh failed, so recommendations use the previous analysis (stale).
          {refresh.lastError && !result ? ` ${refresh.lastError}` : ""}
        </p>
      ) : null}

      {result ? (
        <p
          role={result.status === "failed" ? "alert" : "status"}
          className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
            result.status === "failed"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {describeError(error)}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={busy} onClick={run}>
          {busy ? (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-700"
                aria-hidden="true"
              />
              Refreshing…
            </span>
          ) : (
            "Refresh GitHub profile"
          )}
        </button>
        <p className="text-xs text-slate-500">Last successful: {when(refresh.lastSuccessAt)}.</p>
      </div>
    </section>
  );
}
