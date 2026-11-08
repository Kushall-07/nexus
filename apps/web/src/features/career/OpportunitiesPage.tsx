import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPut } from "../../api/client";
import type {
  ApplicationStatus,
  EmploymentType,
  ExperienceLevel,
  Job,
  OpportunityItem,
  OpportunitySearchResponse,
  SavedJobRecord,
  WorkMode,
} from "../../api/career-types";
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { useToast } from "../../context/ToastContext";
import {
  JobCard,
  MatchDetail,
  ExternalLink,
  MatchBadge,
  JobMeta,
  SourceBadge,
  StatusSelect,
  buttonClass,
  inputClass,
  primaryButtonClass,
} from "./jobParts";
import { IconClose, IconChevronLeft } from "../../components/Icons";

// ── Types and utilities ────────────────────────────────────────────────────────

export interface Filters {
  keywords: string;
  location: string;
  workMode: "" | WorkMode;
  employmentType: "" | EmploymentType;
  experienceLevel: "" | ExperienceLevel;
  source: "live" | "demo";
}

export const EMPTY_FILTERS: Filters = {
  keywords: "", location: "", workMode: "", employmentType: "", experienceLevel: "", source: "live",
};

export function buildSearchPath(filters: Filters): string {
  const params = new URLSearchParams({ source: filters.source, limit: "30" });
  for (const key of ["keywords", "location", "workMode", "employmentType", "experienceLevel"] as const) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  return `/api/opportunities?${params}`;
}

type Patch = { saved: OpportunityItem["saved"] } | { dismissed: true };

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed.");
}


// ── Tracking form (in detail panel) ───────────────────────────────────────────

function TrackingForm({
  item,
  onSaved,
  onError,
}: {
  item: OpportunityItem;
  onSaved: (saved: OpportunityItem["saved"]) => void;
  onError: (error: ApiError) => void;
}) {
  const [status, setStatus] = useState<ApplicationStatus>(item.saved?.status ?? "saved");
  const [note, setNote] = useState(item.saved?.note ?? "");
  const [date, setDate] = useState(item.saved?.statusDate?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const record = await apiPut<SavedJobRecord>(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`, {
        status,
        note,
        statusDate: date ? new Date(`${date}T00:00:00.000Z`).toISOString() : null,
      });
      onSaved({ status: record.status, note: record.note, statusDate: record.statusDate });
    } catch (error) {
      onError(toApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Application tracking">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Track this application</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          NEXUS never applies for you. Update this after applying on the original site.
        </p>
      </div>
      <div>
        <label htmlFor="track-status" className="block text-xs font-medium text-slate-700 mb-1">Status</label>
        <StatusSelect id="track-status" value={status} onChange={setStatus} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-date" className="block text-xs font-medium text-slate-700 mb-1">Date (optional)</label>
        <input id="track-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-note" className="block text-xs font-medium text-slate-700 mb-1">Private note (optional)</label>
        <textarea id="track-note" className={inputClass} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
      </div>
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Saving…" : "Save tracking"}
      </button>
    </form>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
  onToggleSave,
  onTrackingSaved,
  onError,
  busy,
}: {
  item: OpportunityItem;
  onClose?: () => void;
  onToggleSave: (item: OpportunityItem) => void;
  onTrackingSaved: (item: OpportunityItem, saved: OpportunityItem["saved"]) => void;
  onError: (error: ApiError) => void;
  busy: boolean;
}) {
  const { job } = item;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Panel header */}
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 leading-snug">{job.title}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{job.company ?? "Company not provided"}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details panel"
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 lg:hidden"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2">
          <JobMeta job={job} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SourceBadge job={job} />
          {job.stale && (
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              Older listing
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto px-5 py-4 space-y-5">
        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <ExternalLink job={job} />
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleSave(item)}
            aria-label={`${item.saved ? "Remove from saved" : "Save"} ${job.title}`}
            className={buttonClass}
          >
            {busy ? "…" : item.saved ? "Unsave" : "Save job"}
          </button>
        </div>

        {/* Match detail */}
        <MatchDetail item={item} />

        {/* Tracking form (only when saved) */}
        {item.saved && (
          <TrackingForm
            key={item.job.id}
            item={item}
            onSaved={(saved) => onTrackingSaved(item, saved)}
            onError={onError}
          />
        )}

        {!item.saved && (
          <p className="text-xs text-slate-500">
            Save this job to track your application status and add private notes.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Empty detail state ─────────────────────────────────────────────────────────

function NoSelection() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center min-h-[320px]">
      <p className="text-sm font-medium text-slate-700">Select a job to view details</p>
      <p className="mt-1 text-xs text-slate-500">
        Match analysis, skill evidence, and application tracking will appear here.
      </p>
    </div>
  );
}

// ── Results area ───────────────────────────────────────────────────────────────

interface ResultsProps {
  data: OpportunitySearchResponse;
  patches: Record<string, Patch>;
  effectiveItem: (item: OpportunityItem) => OpportunityItem;
  selectedId: string | null;
  onSelect: (item: OpportunityItem) => void;
  onDeselect: () => void;
  onToggleSave: (item: OpportunityItem) => void;
  onDismiss: (item: OpportunityItem) => void;
  busyId: string | null;
  onUseDemo: () => void;
  onTrackingSaved: (item: OpportunityItem, saved: OpportunityItem["saved"]) => void;
  onActionError: (error: ApiError) => void;
}

export function Results({
  data, patches, effectiveItem, selectedId, onSelect, onDeselect,
  onToggleSave, onDismiss, busyId, onUseDemo, onTrackingSaved, onActionError,
}: ResultsProps) {
  if (data.noProviderConfigured) {
    return (
      <EmptyState title="No live job provider is configured">
        <p>
          This server has no job-search credentials, so NEXUS cannot show real listings and will not invent any.
          The owner can enable one or more providers:
        </p>
        <ul className="mt-2 list-disc pl-5 text-left">
          {data.providers.map((provider) => (
            <li key={provider.id}>
              <strong>{provider.label}</strong>: {provider.hint ?? "available"}
            </li>
          ))}
        </ul>
        <button type="button" className={`${buttonClass} mt-3`} onClick={onUseDemo}>
          Explore demo listings
        </button>
      </EmptyState>
    );
  }

  const items = data.items
    .filter((item) => !("dismissed" in (patches[item.job.id] ?? {})))
    .map(effectiveItem);
  const selected = items.find((item) => item.job.id === selectedId) ?? null;
  const failed = data.providers.filter((p) => p.configured && !p.ok);

  return (
    <div className="space-y-3">
      {/* Meta info */}
      {data.mode === "demo" ? (
        <p role="status" className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
          <strong>Demo mode.</strong> These are invented example listings, not real vacancies.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          {data.providers.filter((p) => p.ok).map((p) => p.label).join(", ") || "Live results"}
          {" · "}retrieved {new Date(data.retrievedAt).toLocaleTimeString()}
          {data.providers.some((p) => p.cached) ? " · some results cached" : ""}
          {" · NEXUS cannot confirm a listing is still open."}
        </p>
      )}

      {failed.length > 0 && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Some sources failed — results may be partial:{" "}
          {failed.map((p) => `${p.label} (${p.errorMessage ?? "unavailable"})`).join("; ")}
        </p>
      )}

      {!data.profile.hasGithubAnalysis && !data.profile.hasResume && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 nx-panel">
          <p className="text-sm text-slate-700">
            No GitHub analysis or resume yet — matches cannot be scored.{" "}
            <Link to="/repositories" className="font-medium text-indigo-700 underline">Analyze repositories</Link>{" "}
            or{" "}
            <Link to="/resume" className="font-medium text-indigo-700 underline">add a resume</Link>.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No opportunities match these filters">
          Try fewer filters or different keywords.
          {data.dismissedCount > 0 ? ` ${data.dismissedCount} dismissed listing(s) are hidden.` : ""}
        </EmptyState>
      ) : (
        <>
          {/* Mobile back button (shown when detail is open on small screens) */}
          {selected && (
            <button
              type="button"
              onClick={onDeselect}
              className="mb-1 flex items-center gap-1.5 text-sm font-medium text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 lg:hidden"
            >
              <IconChevronLeft className="h-4 w-4" />
              Back to results
            </button>
          )}

          {/* Split view: single list + optional detail panel */}
          <div className="lg:grid lg:grid-cols-[2fr_3fr] lg:gap-4 lg:items-start">
            {/* Left: job list (hidden on mobile when detail is showing) */}
            <div className={selected ? "hidden lg:block" : ""}>
              <p className="mb-2 text-xs text-slate-500">
                {items.length} result{items.length !== 1 ? "s" : ""}
                {data.dismissedCount > 0 ? ` · ${data.dismissedCount} dismissed` : ""}
              </p>
              <ul className="space-y-3" aria-label="Opportunities">
                {items.map((item) => (
                  <li key={item.job.id}>
                    <JobCard
                      item={item}
                      onDetails={(i) => onSelect(i)}
                      onToggleSave={onToggleSave}
                      onDismiss={onDismiss}
                      busy={busyId === item.job.id}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: detail panel (always in DOM; hidden on mobile when nothing selected) */}
            <aside
              aria-label="Job details"
              className={selected ? "" : "hidden lg:block"}
            >
              {selected ? (
                <DetailPanel
                  item={selected}
                  onToggleSave={onToggleSave}
                  onTrackingSaved={onTrackingSaved}
                  onError={onActionError}
                  busy={busyId === selected.job.id}
                />
              ) : (
                <NoSelection />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export function OpportunitiesPage({ initial = EMPTY_FILTERS }: { initial?: Filters }) {
  const toast = useToast();
  const [form, setForm] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  const { state, reload } = useApiResource(
    () => apiGet<OpportunitySearchResponse>(buildSearchPath(applied)),
    [applied],
  );
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function search(event: FormEvent) {
    event.preventDefault();
    setPatches({});
    setSelectedId(null);
    setApplied({ ...form });
  }

  function useDemo() {
    const next = { ...form, source: "demo" as const };
    setForm(next);
    setPatches({});
    setApplied(next);
  }

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function toggleSave(item: OpportunityItem) {
    setBusyId(item.job.id);
    setActionError(null);
    const current = effectiveItem(item);
    try {
      if (current.saved) {
        await apiDelete(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`);
        setPatches((all) => ({ ...all, [item.job.id]: { saved: null } }));
        toast({ variant: "success", title: "Job removed from saved" });
      } else {
        const record = await apiPut<SavedJobRecord>(
          `/api/saved-jobs/${encodeURIComponent(item.job.id)}`,
          { status: "saved" },
        );
        setPatches((all) => ({
          ...all,
          [item.job.id]: {
            saved: { status: record.status, note: record.note, statusDate: record.statusDate },
          },
        }));
        toast({ variant: "success", title: "Job saved", description: "Find it in Saved Opportunities." });
      }
    } catch (error) {
      const err = toApiError(error);
      setActionError(err);
      toast({ variant: "error", title: "Could not save job", description: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(item: OpportunityItem) {
    setBusyId(item.job.id);
    setActionError(null);
    try {
      await apiPut(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`, { dismissed: true });
      setPatches((all) => ({ ...all, [item.job.id]: { dismissed: true } }));
      if (selectedId === item.job.id) setSelectedId(null);
    } catch (error) {
      const err = toApiError(error);
      setActionError(err);
      toast({ variant: "error", title: "Could not dismiss job", description: err.message });
    } finally {
      setBusyId(null);
    }
  }

  function effectiveItem(item: OpportunityItem): OpportunityItem {
    const patch = patches[item.job.id];
    return patch && "saved" in patch ? { ...item, saved: patch.saved } : item;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1
          className="font-display text-slate-900"
          style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          Job Discovery
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Opportunities ranked by an explainable match with your GitHub evidence and resume.{" "}
          <Link to="/preferences" className="font-medium text-indigo-700 hover:underline">
            Set preferences
          </Link>
        </p>
      </div>

      {/* Search + filter form */}
      <form
        onSubmit={search}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
        aria-label="Search opportunities"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="f-keywords" className="block text-xs font-medium text-slate-700 mb-1">
              Title, keyword, company or technology
            </label>
            <input
              id="f-keywords"
              className={inputClass}
              maxLength={120}
              value={form.keywords}
              onChange={(e) => set("keywords", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="f-location" className="block text-xs font-medium text-slate-700 mb-1">Location</label>
            <input
              id="f-location"
              className={inputClass}
              maxLength={120}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="f-mode" className="block text-xs font-medium text-slate-700 mb-1">Work mode</label>
            <select
              id="f-mode"
              className={inputClass}
              value={form.workMode}
              onChange={(e) => set("workMode", e.target.value as Filters["workMode"])}
            >
              <option value="">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on-site">On-site</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-type" className="block text-xs font-medium text-slate-700 mb-1">Employment type</label>
            <select
              id="f-type"
              className={inputClass}
              value={form.employmentType}
              onChange={(e) => set("employmentType", e.target.value as Filters["employmentType"])}
            >
              <option value="">Any</option>
              <option value="internship">Internship</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-level" className="block text-xs font-medium text-slate-700 mb-1">Experience level</label>
            <select
              id="f-level"
              className={inputClass}
              value={form.experienceLevel}
              onChange={(e) => set("experienceLevel", e.target.value as Filters["experienceLevel"])}
            >
              <option value="">Any</option>
              <option value="intern">Intern</option>
              <option value="entry">Entry</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass}>Search</button>
            {form.source === "demo" && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  const next = { ...form, source: "live" as const };
                  setForm(next);
                  setPatches({});
                  setApplied(next);
                }}
              >
                Back to live
              </button>
            )}
          </div>
        </div>
      </form>

      {state.status === "loading" && <LoadingState label="Searching…" />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={reload} />}

      {state.status === "success" && (
        <Results
          data={state.data}
          patches={patches}
          effectiveItem={effectiveItem}
          selectedId={selectedId}
          onSelect={(item) => setSelectedId(item.job.id)}
          onDeselect={() => setSelectedId(null)}
          onToggleSave={toggleSave}
          onDismiss={dismiss}
          busyId={busyId}
          onUseDemo={useDemo}
          onTrackingSaved={(item, saved) =>
            setPatches((all) => ({ ...all, [item.job.id]: { saved } }))
          }
          onActionError={(err) => {
            setActionError(err);
            toast({ variant: "error", title: "Action failed", description: err.message });
          }}
        />
      )}

      {actionError && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
          {describeError(actionError)}
        </p>
      )}
    </div>
  );
}
