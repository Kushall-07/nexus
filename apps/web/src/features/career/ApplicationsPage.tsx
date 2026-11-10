import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPut } from "../../api/client";
import type { ApplicationStatus, SavedJobRecord } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { ExternalLink, JobMeta, SourceBadge, StatusSelect, buttonClass, inputClass, primaryButtonClass } from "./jobParts";
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";

// ── Status pipeline ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES: ApplicationStatus[] = ["saved", "planning", "applied", "interviewing", "offer"];

const STAGE_STYLE: Record<ApplicationStatus, { dot: string; badge: string }> = {
  saved:        { dot: "bg-slate-400",   badge: "border-slate-200 bg-slate-100 text-slate-700" },
  planning:     { dot: "bg-sky-400",     badge: "border-sky-200 bg-sky-50 text-sky-800" },
  applied:      { dot: "bg-indigo-400",  badge: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  interviewing: { dot: "bg-amber-400",   badge: "border-amber-200 bg-amber-50 text-amber-800" },
  offer:        { dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected:     { dot: "bg-red-400",     badge: "border-red-200 bg-red-50 text-red-800" },
  withdrawn:    { dot: "bg-slate-300",   badge: "border-slate-200 bg-slate-50 text-slate-600" },
};

const STATUS_ACCENT: Record<ApplicationStatus, string> = {
  saved:        "",
  planning:     "",
  applied:      "nx-panel",
  interviewing: "nx-panel-success",
  offer:        "nx-panel-success",
  rejected:     "nx-panel-danger",
  withdrawn:    "",
};

function PipelineBar({ items }: { items: SavedJobRecord[] }) {
  const counts = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, items.filter((r) => r.status === stage).length])
  ) as Record<ApplicationStatus, number>;
  const total = items.length;

  return (
    <div className="nx-card rounded-2xl border border-slate-200 bg-white px-5 py-5">
      <p className="mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">Pipeline</p>
      <div className="flex items-stretch gap-0 overflow-hidden rounded-xl border border-slate-200">
        {PIPELINE_STAGES.map((stage, index) => {
          const count = counts[stage];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const style = STAGE_STYLE[stage];
          return (
            <div
              key={stage}
              className={[
                "flex flex-1 flex-col items-center gap-1 px-2 py-3 text-center transition-colors",
                index < PIPELINE_STAGES.length - 1 ? "border-r border-slate-200" : "",
                count > 0 ? "bg-white" : "bg-slate-50/60",
              ].join(" ")}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
              <span className="text-xs font-medium text-slate-700 capitalize hidden sm:block">
                {APPLICATION_STATUS_LABELS[stage]}
              </span>
              <span className="tabular-nums text-lg font-bold text-slate-900">{count}</span>
              {total > 0 ? (
                <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Application row ─────────────────────────────────────────────────────────────

function Row({ record, onChange, onRemove, onError }: {
  record: SavedJobRecord;
  onChange: (record: SavedJobRecord) => void;
  onRemove: (jobId: string) => void;
  onError: (error: ApiError) => void;
}) {
  const [status, setStatus] = useState<ApplicationStatus>(record.status);
  const [note, setNote] = useState(record.note);
  const [date, setDate] = useState(record.statusDate?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const path = `/api/saved-jobs/${encodeURIComponent(record.jobId)}`;
  const fail = (error: unknown) => onError(error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
  const style = STAGE_STYLE[record.status];

  async function save() {
    setBusy(true);
    try {
      onChange(await apiPut<SavedJobRecord>(path, { status, note, statusDate: date ? new Date(`${date}T00:00:00.000Z`).toISOString() : null }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiDelete(path);
      onRemove(record.jobId);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  const id = record.jobId.replace(/[^a-z0-9]/gi, "-");

  return (
    <li className={`nx-card rounded-2xl border border-slate-200 bg-white p-5 ${STATUS_ACCENT[record.status]}`}>
      {/* Job header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900 leading-snug text-base">{record.job.title}</h2>
          <p className="text-sm text-slate-600 mt-0.5">{record.job.company ?? "Company not provided"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
            {APPLICATION_STATUS_LABELS[record.status]}
          </span>
          <SourceBadge job={record.job} />
        </div>
      </div>
      <div className="mt-2">
        <JobMeta job={record.job} />
      </div>

      {/* Tracking form */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <div>
          <label htmlFor={`s-${id}`} className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Status</label>
          <StatusSelect id={`s-${id}`} value={status} onChange={setStatus} disabled={busy} />
        </div>
        <div>
          <label htmlFor={`d-${id}`} className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Date</label>
          <input id={`d-${id}`} type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`n-${id}`} className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Private note</label>
          <textarea id={`n-${id}`} className={inputClass} rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} disabled={busy} onClick={save} style={{ color: "var(--color-indigo-950)" }}>
          Save changes{" "}<span className="sr-only">for {record.job.title}</span>
        </button>
        <button type="button" className={buttonClass} disabled={busy} onClick={remove}>
          Remove{" "}<span className="sr-only">{record.job.title}</span>
        </button>
        <ExternalLink job={record.job} />
      </div>
    </li>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export function ApplicationsPage() {
  const { state, reload } = useApiResource(() => apiGet<{ items: SavedJobRecord[] }>("/api/saved-jobs"), []);
  const [items, setItems] = useState<SavedJobRecord[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (state.status === "success") setItems(state.data.items);
  }, [state]);

  if (state.status === "loading") return <LoadingState label="Loading your saved jobs…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const list = items ?? state.data.items;
  const active = list.filter((record) => !record.dismissed);
  const dismissed = list.filter((record) => record.dismissed);

  async function restore(record: SavedJobRecord) {
    try {
      const updated = await apiPut<SavedJobRecord>(`/api/saved-jobs/${encodeURIComponent(record.jobId)}`, { dismissed: false });
      setItems(list.map((entry) => (entry.jobId === updated.jobId ? updated : entry)));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    }
  }

  return (
    <div className="space-y-6 nx-stagger">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
          Applications
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your private tracker — NEXUS never submits applications on your behalf.{" "}
          <Link to="/opportunities" className="font-medium text-indigo-700 hover:underline">
            Find opportunities
          </Link>
        </p>
      </div>

      {error ? (
        <div role="alert" className="nx-card rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {describeError(error)}
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyState title="Nothing saved yet">
          Save a job from{" "}
          <Link to="/opportunities" className="underline text-indigo-700">Opportunities</Link>{" "}
          to start tracking it.
        </EmptyState>
      ) : (
        <>
          <PipelineBar items={active} />
          <ul className="space-y-4" aria-label="Saved jobs">
            {active.map((record) => (
              <Row
                key={record.jobId}
                record={record}
                onChange={(updated) => setItems(list.map((entry) => (entry.jobId === updated.jobId ? updated : entry)))}
                onRemove={(jobId) => setItems(list.filter((entry) => entry.jobId !== jobId))}
                onError={setError}
              />
            ))}
          </ul>
        </>
      )}

      {dismissed.length > 0 ? (
        <section aria-label="Dismissed recommendations">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">Dismissed ({dismissed.length})</h2>
          <ul className="space-y-2">
            {dismissed.map((record) => (
              <li
                key={record.jobId}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <span className="truncate text-slate-700">
                  {record.job.title}{record.job.company ? ` — ${record.job.company}` : ""}
                </span>
                <button type="button" className={`${buttonClass} ml-3 shrink-0`} onClick={() => restore(record)}>
                  Restore{" "}<span className="sr-only">{record.job.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
