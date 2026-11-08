import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPut } from "../../api/client";
import type { ApplicationStatus, SavedJobRecord } from "../../api/career-types";
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { ExternalLink, JobMeta, SourceBadge } from "./jobParts";

// Statuses considered "saved / considering" (not yet in active application pipeline)
const SAVED_STATUSES: ApplicationStatus[] = ["saved", "planning"];

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const isSaved = status === "saved";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        isSaved
          ? "bg-indigo-100 text-indigo-900 border border-indigo-200"
          : "bg-amber-100 text-amber-900 border border-amber-200",
      ].join(" ")}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

function SavedJobRow({
  record,
  onMoveToApplications,
  onRemove,
  onError,
}: {
  record: SavedJobRecord;
  onMoveToApplications: (record: SavedJobRecord) => void;
  onRemove: (jobId: string) => void;
  onError: (err: ApiError) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    setBusy(true);
    try {
      await apiDelete(`/api/saved-jobs/${encodeURIComponent(record.jobId)}`);
      onRemove(record.jobId);
    } catch (err) {
      onError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveToApplied() {
    setBusy(true);
    try {
      const updated = await apiPut<SavedJobRecord>(
        `/api/saved-jobs/${encodeURIComponent(record.jobId)}`,
        { status: "applied" },
      );
      onMoveToApplications(updated);
    } catch (err) {
      onError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 leading-snug">{record.job.title}</h3>
          <p className="mt-0.5 text-sm text-slate-600">{record.job.company ?? "Company not provided"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={record.status} />
          <SourceBadge job={record.job} />
        </div>
      </div>

      <div className="mt-2">
        <JobMeta job={record.job} />
      </div>

      {record.note ? (
        <p className="mt-2 text-xs text-slate-500 italic line-clamp-2">{record.note}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleMoveToApplied}
          className="inline-flex items-center rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-indigo-950 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 disabled:opacity-50"
        >
          Mark as Applied
        </button>
        <ExternalLink job={record.job} />
        <button
          type="button"
          disabled={busy}
          onClick={handleRemove}
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 disabled:opacity-50 transition-colors"
        >
          Remove<span className="sr-only"> {record.job.title}</span>
        </button>
      </div>
    </li>
  );
}

export function SavedOpportunitiesPage() {
  const navigate = useNavigate();
  const { state, reload } = useApiResource(
    () => apiGet<{ items: SavedJobRecord[] }>("/api/saved-jobs"),
    [],
  );
  const [items, setItems] = useState<SavedJobRecord[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  if (state.status === "loading") return <LoadingState label="Loading saved opportunities…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const allItems = items ?? state.data.items;
  const savedItems = allItems.filter(
    (r) => !r.dismissed && SAVED_STATUSES.includes(r.status),
  );
  const inPipelineCount = allItems.filter(
    (r) => !r.dismissed && !SAVED_STATUSES.includes(r.status),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-slate-900"
            style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Saved Opportunities
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Jobs you&apos;re considering. Ready to apply? Move them to your application tracker.
          </p>
        </div>
        <Link
          to="/opportunities"
          className="inline-flex items-center rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-950 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
        >
          Find more jobs
        </Link>
      </div>

      {/* In-pipeline notice */}
      {inPipelineCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm nx-panel">
          <p className="text-indigo-900">
            <span className="font-semibold">{inPipelineCount}</span>{" "}
            {inPipelineCount === 1 ? "job is" : "jobs are"} in your application pipeline.
          </p>
          <button
            type="button"
            onClick={() => navigate("/applications")}
            className="ml-4 shrink-0 text-sm font-medium text-indigo-700 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            View Applications
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
          {describeError(error)}
        </p>
      )}

      {/* Saved jobs list */}
      {savedItems.length === 0 ? (
        <EmptyState title="No saved opportunities yet">
          Browse{" "}
          <Link to="/opportunities" className="underline text-indigo-700">
            Job Discovery
          </Link>{" "}
          and save jobs you want to revisit. They&apos;ll appear here for easy comparison.
        </EmptyState>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {savedItems.length} {savedItems.length === 1 ? "job" : "jobs"} saved
          </p>
          <ul className="space-y-3" aria-label="Saved opportunities">
            {savedItems.map((record) => (
              <SavedJobRow
                key={record.jobId}
                record={record}
                onMoveToApplications={(updated) => {
                  setItems(allItems.map((r) => (r.jobId === updated.jobId ? updated : r)));
                }}
                onRemove={(jobId) => {
                  setItems(allItems.filter((r) => r.jobId !== jobId));
                }}
                onError={setError}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
