import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPut } from "../../api/client";
import type {
  ApplicationStatus,
  EmploymentType,
  ExperienceLevel,
  OpportunityItem,
  OpportunitySearchResponse,
  SavedJobRecord,
  WorkMode,
} from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { JobCard, MatchDetail, ExternalLink, StatusSelect, buttonClass, inputClass, primaryButtonClass } from "./jobParts";

export interface Filters {
  keywords: string;
  location: string;
  workMode: "" | WorkMode;
  employmentType: "" | EmploymentType;
  experienceLevel: "" | ExperienceLevel;
  source: "live" | "demo";
}

export const EMPTY_FILTERS: Filters = { keywords: "", location: "", workMode: "", employmentType: "", experienceLevel: "", source: "live" };

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

function TrackingForm({ item, onSaved, onError }: { item: OpportunityItem; onSaved: (saved: OpportunityItem["saved"]) => void; onError: (error: ApiError) => void }) {
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
    <form onSubmit={submit} className="space-y-2 rounded-md border border-slate-200 p-3" aria-label="Application tracking">
      <h4 className="font-semibold text-slate-900">Track your application</h4>
      <p className="text-xs text-slate-600">NEXUS never applies for you. Update this yourself after you apply on the original site.</p>
      <div>
        <label htmlFor="track-status" className="block text-sm font-medium text-slate-800">Status</label>
        <StatusSelect id="track-status" value={status} onChange={setStatus} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-date" className="block text-sm font-medium text-slate-800">Date (optional)</label>
        <input id="track-date" type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-note" className="block text-sm font-medium text-slate-800">Private note (optional)</label>
        <textarea id="track-note" className={inputClass} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} />
      </div>
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Saving..." : "Save tracking"}
      </button>
    </form>
  );
}

export function OpportunitiesPage({ initial = EMPTY_FILTERS }: { initial?: Filters }) {
  const [form, setForm] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  const { state, reload } = useApiResource(() => apiGet<OpportunitySearchResponse>(buildSearchPath(applied)), [applied]);
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

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function toggleSave(item: OpportunityItem) {
    setBusyId(item.job.id);
    setActionError(null);
    const current = effectiveItem(item);
    try {
      if (current.saved) {
        await apiDelete(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`);
        setPatches((all) => ({ ...all, [item.job.id]: { saved: null } }));
      } else {
        const record = await apiPut<SavedJobRecord>(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`, { status: "saved" });
        setPatches((all) => ({ ...all, [item.job.id]: { saved: { status: record.status, note: record.note, statusDate: record.statusDate } } }));
      }
    } catch (error) {
      setActionError(toApiError(error));
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
      setActionError(toApiError(error));
    } finally {
      setBusyId(null);
    }
  }

  function effectiveItem(item: OpportunityItem): OpportunityItem {
    const patch = patches[item.job.id];
    return patch && "saved" in patch ? { ...item, saved: patch.saved } : item;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <p className="text-sm text-slate-600">
          Jobs and internships ranked by an explainable match with your GitHub evidence and resume. You do not need to choose a target role.{" "}
          <Link to="/preferences" className="underline">Set preferences</Link>
        </p>
      </div>

      <form onSubmit={search} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Search opportunities">
        <div>
          <label htmlFor="f-keywords" className="block text-sm font-medium text-slate-800">Title, keyword, company or technology</label>
          <input id="f-keywords" className={inputClass} maxLength={120} value={form.keywords} onChange={(event) => set("keywords", event.target.value)} />
        </div>
        <div>
          <label htmlFor="f-location" className="block text-sm font-medium text-slate-800">Location</label>
          <input id="f-location" className={inputClass} maxLength={120} value={form.location} onChange={(event) => set("location", event.target.value)} />
        </div>
        <div>
          <label htmlFor="f-mode" className="block text-sm font-medium text-slate-800">Work mode</label>
          <select id="f-mode" className={inputClass} value={form.workMode} onChange={(event) => set("workMode", event.target.value as Filters["workMode"])}>
            <option value="">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="block text-sm font-medium text-slate-800">Employment type</label>
          <select id="f-type" className={inputClass} value={form.employmentType} onChange={(event) => set("employmentType", event.target.value as Filters["employmentType"])}>
            <option value="">Any</option>
            <option value="internship">Internship</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-level" className="block text-sm font-medium text-slate-800">Experience level</label>
          <select id="f-level" className={inputClass} value={form.experienceLevel} onChange={(event) => set("experienceLevel", event.target.value as Filters["experienceLevel"])}>
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
          {form.source === "demo" ? (
            <button type="button" className={buttonClass} onClick={() => { const next = { ...form, source: "live" as const }; setForm(next); setPatches({}); setApplied(next); }}>
              Back to live sources
            </button>
          ) : null}
        </div>
      </form>

      {state.status === "loading" ? <LoadingState label="Searching opportunities..." /> : null}
      {state.status === "error" ? <ErrorState error={state.error} onRetry={reload} /> : null}

      {state.status === "success" ? (
        <Results
          data={state.data}
          patches={patches}
          effectiveItem={effectiveItem}
          selectedId={selectedId}
          onSelect={(item) => setSelectedId(item.job.id)}
          onToggleSave={toggleSave}
          onDismiss={dismiss}
          busyId={busyId}
          onUseDemo={useDemo}
          onTrackingSaved={(item, saved) => setPatches((all) => ({ ...all, [item.job.id]: { saved } }))}
          onActionError={setActionError}
        />
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{describeError(actionError)}</p>
      ) : null}
    </div>
  );
}

interface ResultsProps {
  data: OpportunitySearchResponse;
  patches: Record<string, Patch>;
  effectiveItem: (item: OpportunityItem) => OpportunityItem;
  selectedId: string | null;
  onSelect: (item: OpportunityItem) => void;
  onToggleSave: (item: OpportunityItem) => void;
  onDismiss: (item: OpportunityItem) => void;
  busyId: string | null;
  onUseDemo: () => void;
  onTrackingSaved: (item: OpportunityItem, saved: OpportunityItem["saved"]) => void;
  onActionError: (error: ApiError) => void;
}

export function Results({ data, patches, effectiveItem, selectedId, onSelect, onToggleSave, onDismiss, busyId, onUseDemo, onTrackingSaved, onActionError }: ResultsProps) {
  if (data.noProviderConfigured) {
    return (
      <EmptyState title="No live job provider is configured">
        <p>
          This server has no job-search credentials, so NEXUS cannot show real listings and will not invent any. The owner can enable one or more providers
          in the server environment:
        </p>
        <ul className="mt-2 list-disc pl-5">
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

  const items = data.items.filter((item) => !("dismissed" in (patches[item.job.id] ?? {}))).map(effectiveItem);
  const selected = items.find((item) => item.job.id === selectedId) ?? null;
  const failed = data.providers.filter((provider) => provider.configured && !provider.ok);

  return (
    <div className="space-y-3">
      {data.mode === "demo" ? (
        <p role="status" className="rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-900">
          <strong>Demo mode.</strong> These are invented example listings from fictional employers, not real vacancies. Their links go to example.com.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Live results from {data.providers.filter((provider) => provider.ok).map((provider) => provider.label).join(", ") || "no provider"} · retrieved{" "}
          {new Date(data.retrievedAt).toLocaleTimeString()}
          {data.providers.some((provider) => provider.cached) ? " · some results are cached and may not be current" : ""}. NEXUS cannot confirm a listing is still open.
        </p>
      )}
      {failed.length > 0 ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Some sources failed, so results may be partial: {failed.map((provider) => `${provider.label} (${provider.errorMessage ?? "unavailable"})`).join("; ")}
        </p>
      ) : null}
      {!data.profile.hasGithubAnalysis && !data.profile.hasResume ? (
        <p className="rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-800">
          You have no GitHub analysis or resume yet, so matches cannot be scored. Analyze your repositories on the <Link to="/repositories" className="underline">Repositories</Link>{" "}
          page or add a <Link to="/resume" className="underline">resume</Link>.
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="No opportunities match these filters">
          Try fewer filters or different keywords.{data.dismissedCount > 0 ? ` ${data.dismissedCount} dismissed listing(s) are hidden.` : ""}
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul className="space-y-3" aria-label="Opportunities">
            {items.map((item) => (
              <li key={item.job.id}>
                <JobCard item={item} onDetails={onSelect} onToggleSave={onToggleSave} onDismiss={onDismiss} busy={busyId === item.job.id} />
              </li>
            ))}
          </ul>
          <aside aria-label="Job details" className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {selected ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-semibold">{selected.job.title}</h2>
                <ExternalLink job={selected.job} />
                <MatchDetail item={selected} />
                {selected.saved ? <TrackingForm key={selected.job.id} item={selected} onSaved={(saved) => onTrackingSaved(selected, saved)} onError={onActionError} /> : <p className="text-sm text-slate-600">Save this job to track your application.</p>}
              </div>
            ) : (
              <EmptyState title="Select a job">Choose “View details” on a listing to see why it matches, what is missing and the original link.</EmptyState>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
