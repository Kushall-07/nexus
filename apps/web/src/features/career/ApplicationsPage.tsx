import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPut } from "../../api/client";
import type { ApplicationStatus, SavedJobRecord } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { ExternalLink, JobMeta, SourceBadge, StatusSelect, buttonClass, inputClass, primaryButtonClass } from "./jobParts";
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";

const STATUS_ACCENT: Record<ApplicationStatus, string> = {
  saved: "",
  planning: "",
  applied: "nx-panel",
  interviewing: "nx-panel-success",
  offer: "nx-panel-success",
  rejected: "nx-panel-danger",
  withdrawn: "",
};

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
    <li className={`rounded-xl border border-slate-200 bg-white p-4 ${STATUS_ACCENT[record.status]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 leading-snug">{record.job.title}</h3>
          <p className="text-sm text-slate-600">{record.job.company ?? "Company not provided"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {APPLICATION_STATUS_LABELS[record.status]}
          </span>
          <SourceBadge job={record.job} />
        </div>
      </div>
      <div className="mt-1.5">
        <JobMeta job={record.job} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`s-${id}`} className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <StatusSelect id={`s-${id}`} value={status} onChange={setStatus} disabled={busy} />
        </div>
        <div>
          <label htmlFor={`d-${id}`} className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input id={`d-${id}`} type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`n-${id}`} className="block text-xs font-medium text-slate-600 mb-1">Private note</label>
          <textarea id={`n-${id}`} className={inputClass} rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} disabled={busy} onClick={save}>
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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Saved jobs &amp; applications</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Your private tracker. NEXUS never submits applications on your behalf.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
          {describeError(error)}
        </p>
      ) : null}

      {active.length === 0 ? (
        <EmptyState title="Nothing saved yet">
          Save a job from{" "}
          <Link to="/opportunities" className="underline text-indigo-700">Opportunities</Link>{" "}
          to start tracking it.
        </EmptyState>
      ) : (
        <ul className="space-y-3" aria-label="Saved jobs">
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
      )}

      {dismissed.length > 0 ? (
        <section aria-label="Dismissed recommendations">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Dismissed recommendations</h2>
          <ul className="space-y-2">
            {dismissed.map((record) => (
              <li
                key={record.jobId}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
