import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, SlidersHorizontal, X } from "lucide-react";
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
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { useToast } from "../../context/ToastContext";
import {
  ExternalLink,
  JobMeta,
  MatchBadge,
  MatchDetail,
  SourceBadge,
  StatusSelect,
  buttonClass,
  inputClass,
  primaryButtonClass,
  skillLabel,
} from "./jobParts";
import { CountUp, HeroGlow, Ring, SKILL_STATUS, ScoreRing, heroShell } from "./spotlight";

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

type Tab = "all" | "strong" | "potential" | "stretch" | "other";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "all", label: "All" },
  { key: "strong", label: "Strong" },
  { key: "potential", label: "Potential" },
  { key: "stretch", label: "Stretch" },
  { key: "other", label: "Needs review" },
];

function tierOf(item: OpportunityItem): Exclude<Tab, "all"> {
  const label = item.match.label;
  return label === "strong" || label === "potential" || label === "stretch" ? label : "other";
}

function StaleBadge() {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">Older listing</span>
  );
}

function SavedBadge({ item }: { item: OpportunityItem }) {
  if (!item.saved) return null;
  return (
    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
      {APPLICATION_STATUS_LABELS[item.saved.status]}
    </span>
  );
}

interface ItemHandlers {
  onDetails: (item: OpportunityItem) => void;
  onToggleSave: (item: OpportunityItem) => void;
  onDismiss: (item: OpportunityItem) => void;
  busyId: string | null;
}

// ── Tracking form (in the details panel) ───────────────────────────────────────

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
    <form onSubmit={submit} className="nx-card space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Application tracking">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Track this application</h4>
        <p className="mt-0.5 text-xs text-slate-500">
          NEXUS never applies for you. Update this after applying on the original site.
        </p>
      </div>
      <div>
        <label htmlFor="track-status" className="mb-1 block text-xs font-medium text-slate-700">Status</label>
        <StatusSelect id="track-status" value={status} onChange={setStatus} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-date" className="mb-1 block text-xs font-medium text-slate-700">Date (optional)</label>
        <input id="track-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
      </div>
      <div>
        <label htmlFor="track-note" className="mb-1 block text-xs font-medium text-slate-700">Private note (optional)</label>
        <textarea id="track-note" className={inputClass} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
      </div>
      <button type="submit" className={primaryButtonClass} disabled={busy}>
        {busy ? "Saving…" : "Save tracking"}
      </button>
    </form>
  );
}

// ── Details panel (slides in from the right) ───────────────────────────────────

function DetailPanel({
  item,
  onClose,
  onToggleSave,
  onTrackingSaved,
  onError,
  busy,
}: {
  item: OpportunityItem;
  onClose: () => void;
  onToggleSave: (item: OpportunityItem) => void;
  onTrackingSaved: (item: OpportunityItem, saved: OpportunityItem["saved"]) => void;
  onError: (error: ApiError) => void;
  busy: boolean;
}) {
  const { job, match } = item;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={match.score} label={match.label} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-slate-900">{job.title}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{job.company ?? "Company not provided"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details panel"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
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

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
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

        <MatchDetail item={item} />

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

/**
 * Non-modal slide-over: the list stays visible and usable behind it, so you can
 * click another job and the panel swaps. Esc or the close button dismisses it.
 */
function DetailDrawer({
  item,
  onClose,
  onToggleSave,
  onTrackingSaved,
  onError,
  busy,
}: {
  item: OpportunityItem | null;
  onClose: () => void;
  onToggleSave: (item: OpportunityItem) => void;
  onTrackingSaved: (item: OpportunityItem, saved: OpportunityItem["saved"]) => void;
  onError: (error: ApiError) => void;
  busy: boolean;
}) {
  return (
    <DialogPrimitive.Root open={item !== null} modal={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={(event) => event.preventDefault()}
          className="nx-sheet nx-sheet-right fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_-30px_rgba(14,79,74,0.5)] focus:outline-none sm:w-[30rem]"
        >
          <DialogPrimitive.Title className="sr-only">Job details</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Match analysis, skill evidence and application tracking for the selected job.
          </DialogPrimitive.Description>
          {item && (
            <aside aria-label="Job details" className="h-full min-h-0">
              <DetailPanel
                item={item}
                onClose={onClose}
                onToggleSave={onToggleSave}
                onTrackingSaved={onTrackingSaved}
                onError={onError}
                busy={busy}
              />
            </aside>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Filter rail ────────────────────────────────────────────────────────────────

function FilterRail({
  form,
  set,
  onSubmit,
  onBackToLive,
}: {
  form: Filters;
  set: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onSubmit: (event: FormEvent) => void;
  onBackToLive: () => void;
}) {
  const label = "mb-1 block text-xs font-medium text-slate-700";
  return (
    <form
      onSubmit={onSubmit}
      className="nx-card space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4"
      aria-label="Search opportunities"
    >
      <div>
        <label htmlFor="f-keywords" className={label}>Title, keyword, company or technology</label>
        <input id="f-keywords" className={inputClass} maxLength={120} value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
      </div>
      <div>
        <label htmlFor="f-location" className={label}>Location</label>
        <input id="f-location" className={inputClass} maxLength={120} value={form.location} onChange={(e) => set("location", e.target.value)} />
      </div>
      <div>
        <label htmlFor="f-mode" className={label}>Work mode</label>
        <select id="f-mode" className={inputClass} value={form.workMode} onChange={(e) => set("workMode", e.target.value as Filters["workMode"])}>
          <option value="">Any</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="on-site">On-site</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-type" className={label}>Employment type</label>
        <select id="f-type" className={inputClass} value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as Filters["employmentType"])}>
          <option value="">Any</option>
          <option value="internship">Internship</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-level" className={label}>Experience level</label>
        <select id="f-level" className={inputClass} value={form.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value as Filters["experienceLevel"])}>
          <option value="">Any</option>
          <option value="intern">Intern</option>
          <option value="entry">Entry</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead</option>
        </select>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <button type="submit" className={`${primaryButtonClass} w-full py-2.5`} style={{ color: "var(--color-indigo-950)" }}>Search</button>
        {form.source === "demo" && (
          <button type="button" className={`${buttonClass} w-full`} onClick={onBackToLive}>Back to live</button>
        )}
      </div>
    </form>
  );
}

// ── Spotlight: best match ──────────────────────────────────────────────────────

function Spotlight({ item, onDetails, onToggleSave, onDismiss, busyId }: { item: OpportunityItem } & ItemHandlers) {
  const { job, match } = item;
  const busy = busyId === job.id;
  const required = match.skills.filter((s) => s.requirement === "required");
  const supported = required.filter((s) => s.status === "github");
  const skillRows = [...required, ...match.skills.filter((s) => s.requirement !== "required")].slice(0, 4);
  const ghost =
    "rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";
  const ghostSm =
    "rounded-full px-3 py-1.5 text-xs font-semibold text-indigo-100 transition-colors hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-labelledby={`job-${job.id}`}
      className={`${heroShell} grid gap-x-6 gap-y-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-7`}
    >
      <HeroGlow />
      <div className="relative">
        <Ring progress={match.score !== null ? match.score / 100 : 0} size={116}>
          <span className="font-display text-[3rem] leading-none text-[var(--color-indigo-950)]">
            {match.score !== null ? <CountUp value={match.score} /> : "—"}
          </span>
        </Ring>
      </div>

      <div className="relative min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">Your best match</p>
        <h2 id={`job-${job.id}`} className="font-display mt-1 text-[2rem] leading-[0.95] tracking-tight text-[var(--color-indigo-950)]">
          {job.title}
        </h2>
        <p className="mt-1.5 text-sm text-indigo-100/90">{job.company ?? "Company not provided"}</p>
        <div className="mt-1.5 [&_p]:text-indigo-100/80">
          <JobMeta job={job} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MatchBadge match={match} />
          <SourceBadge job={job} />
          {job.stale ? <StaleBadge /> : null}
          <SavedBadge item={item} />
        </div>
        {required.length > 0 && (
          <p className="mt-3 text-xs text-indigo-100/80">
            <span className="font-semibold tabular-nums text-white">{supported.length}</span> of{" "}
            <span className="font-semibold tabular-nums text-white">{required.length}</span> required skills supported by GitHub evidence.
          </p>
        )}
        {match.hardBlockers.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-amber-200">Blocker: {match.hardBlockers[0]}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDetails(item)}
            className="inline-flex items-center gap-2 rounded-full bg-[oklch(62%_0.17_36)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800"
          >
            View details<span className="sr-only"> for {job.title}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`${ghost} inline-flex items-center`}
          >
            {job.isDemo ? "Open example page" : "Open original listing"}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={ghostSm}
            disabled={busy}
            aria-label={`${item.saved ? "Unsave" : "Save"} ${job.title}`}
            onClick={() => onToggleSave(item)}
          >
            {item.saved ? "Unsave" : "Save"}
          </button>
          <button
            type="button"
            className={ghostSm}
            disabled={busy}
            aria-label={`Not interested in ${job.title}`}
            onClick={() => onDismiss(item)}
          >
            Not interested
          </button>
        </div>
      </div>

      <div className="relative min-w-0 rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm sm:col-span-2">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-200">Skill check</p>
        {skillRows.length === 0 ? (
          <p className="text-sm text-indigo-100/80">No skill requirements were listed for this role.</p>
        ) : (
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {skillRows.map((s) => {
              const meta = SKILL_STATUS[s.status] ?? SKILL_STATUS.missing!;
              return (
                <li key={s.skill} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="truncate font-medium capitalize">{skillLabel(s.skill)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-indigo-100/75">{meta.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.section>
  );
}

// ── Result row (with an inline "Why this match") ───────────────────────────────

function ResultRow({ item, onDetails, onToggleSave, onDismiss, busyId }: { item: OpportunityItem } & ItemHandlers) {
  const [why, setWhy] = useState(false);
  const { job, match } = item;
  const busy = busyId === job.id;
  const required = match.skills.filter((s) => s.requirement === "required");
  const supported = required.filter((s) => s.status === "github");
  const whyId = `why-${job.id}`;

  return (
    <article aria-labelledby={`job-${job.id}`} className="nx-card rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex gap-4">
        <ScoreRing score={match.score} label={match.label} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <h3 id={`job-${job.id}`} className="font-semibold leading-snug text-slate-900">{job.title}</h3>
              <p className="mt-0.5 text-sm text-slate-500">{job.company ?? "Company not provided"}</p>
            </div>
            <MatchBadge match={match} />
          </div>
          <div className="mt-1.5">
            <JobMeta job={job} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SourceBadge job={job} />
            {job.stale ? <StaleBadge /> : null}
            <SavedBadge item={item} />
          </div>
          {required.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold tabular-nums text-slate-700">{supported.length}</span>
              {" of "}
              <span className="font-semibold tabular-nums text-slate-700">{required.length}</span>
              {" required skills supported by GitHub evidence."}
            </p>
          ) : null}
          {match.hardBlockers.length > 0 ? (
            <p className="mt-2 text-xs font-semibold text-red-700">Blocker: {match.hardBlockers[0]}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => onDetails(item)}
              style={{ color: "var(--color-indigo-950)" }}
            >
              View details<span className="sr-only"> for {job.title}</span>
            </button>
            <button
              type="button"
              aria-label={`${item.saved ? "Unsave" : "Save"} ${job.title}`}
              className={buttonClass}
              disabled={busy}
              onClick={() => onToggleSave(item)}
            >
              {item.saved ? "Unsave" : "Save"}
            </button>
            <button
              type="button"
              aria-label={`Not interested in ${job.title}`}
              className={buttonClass}
              disabled={busy}
              onClick={() => onDismiss(item)}
            >
              Not interested
            </button>
            <ExternalLink job={job} />
            <button
              type="button"
              aria-expanded={why}
              aria-controls={whyId}
              onClick={() => setWhy((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
            >
              Why this match
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${why ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>

          {why && (
            <div id={whyId} className="mt-3 grid gap-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 font-bold uppercase tracking-wider text-slate-500">Score parts</p>
                {match.components.length === 0 ? (
                  <p className="text-slate-500">No score parts were computed.</p>
                ) : (
                  <ul className="space-y-2">
                    {match.components.slice(0, 4).map((c) => (
                      <li key={c.key}>
                        <div className="flex justify-between">
                          <span className="capitalize">{c.key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>
                          <span className="tabular-nums font-semibold">{c.value === null ? "—" : `${Math.round(c.value * 100)}%`}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="nx-score-fill h-full rounded-full" style={{ width: `${c.value === null ? 0 : Math.round(c.value * 100)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 font-bold uppercase tracking-wider text-slate-500">Skills</p>
                {match.skills.length === 0 ? (
                  <p className="text-slate-500">The listing does not state recognisable skills.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {match.skills.slice(0, 5).map((s) => {
                      const meta = SKILL_STATUS[s.status] ?? SKILL_STATUS.missing!;
                      return (
                        <li key={s.skill} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                            <span className="truncate font-medium capitalize">{skillLabel(s.skill)}</span>
                          </span>
                          <span className="shrink-0 text-slate-500">{meta.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => onDetails(item)}
                  className="mt-3 inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                >
                  Full breakdown <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Shortlist (saved jobs found in these results) ──────────────────────────────

function Shortlist({ saved, onDetails }: { saved: OpportunityItem[]; onDetails: (item: OpportunityItem) => void }) {
  const cols = saved.length >= 3 ? "xl:grid-cols-3" : saved.length === 2 ? "sm:grid-cols-2" : "";
  return (
    <section aria-label="Your shortlist" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Your shortlist</h2>
        <Link
          to="/saved"
          className="rounded text-xs font-semibold text-indigo-700 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
        >
          View all saved →
        </Link>
      </div>
      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing saved from these results yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Save a job and it appears here with its application status and your private note.
          </p>
        </div>
      ) : (
        <ul className={`grid grid-cols-1 items-stretch gap-3 ${cols}`}>
          {saved.map((item) => (
            <li key={item.job.id} className="flex">
              <div className="nx-card flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.job.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.job.company ?? "Company not provided"}</p>
                  </div>
                  <SavedBadge item={item} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                  {item.saved?.note ? item.saved.note : "No private note yet."}
                </p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-xs text-slate-400">
                    {item.saved?.statusDate ? new Date(item.saved.statusDate).toLocaleDateString() : "No date set"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Open details for ${item.job.title}`}
                    onClick={() => onDetails(item)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                  >
                    Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  const [tab, setTab] = useState<Tab>("all");

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
  // Best score first; ties keep the order the API returned.
  const ranked = [...items].sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
  const best = ranked[0] ?? null;
  const selected = items.find((item) => item.job.id === selectedId) ?? null;
  const failed = data.providers.filter((p) => p.configured && !p.ok);

  const counts: Record<Tab, number> = { all: items.length, strong: 0, potential: 0, stretch: 0, other: 0 };
  for (const item of items) counts[tierOf(item)] += 1;
  const rows = ranked.filter((item) => item !== best && (tab === "all" || tierOf(item) === tab));
  const saved = ranked.filter((item) => item.saved);

  return (
    <div className="space-y-5">
      {data.mode === "demo" ? (
        <p role="status" className="rounded-2xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
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
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Some sources failed — results may be partial:{" "}
          {failed.map((p) => `${p.label} (${p.errorMessage ?? "unavailable"})`).join("; ")}
        </p>
      )}

      {!data.profile.hasGithubAnalysis && !data.profile.hasResume && (
        <div className="nx-card nx-panel rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
          {best && (
            <Spotlight item={best} onDetails={onSelect} onToggleSave={onToggleSave} onDismiss={onDismiss} busyId={busyId} />
          )}

          <div>
            <div role="tablist" aria-label="Match tier" className="flex flex-wrap gap-1 border-b border-slate-200">
              {TABS.filter((t) => t.key === "all" || counts[t.key] > 0).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={[
                    "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
                    tab === t.key ? "border-indigo-700 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
                  ].join(" ")}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-2 text-[11px] tabular-nums ${
                      tab === t.key ? "bg-indigo-700 text-[var(--color-indigo-950)]" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            <p className="mb-3 mt-3 text-xs text-slate-500">
              {items.length} result{items.length !== 1 ? "s" : ""}
              {data.dismissedCount > 0 ? ` · ${data.dismissedCount} dismissed` : ""}
            </p>

            {rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-6 text-center text-sm text-slate-500">
                {tab === "all" ? "Your best match is highlighted above." : "Nothing else in this tier. Your best match is highlighted above."}
              </p>
            ) : (
              <ul className="space-y-3" aria-label="Opportunities">
                {rows.map((item) => (
                  <li key={item.job.id}>
                    <ResultRow item={item} onDetails={onSelect} onToggleSave={onToggleSave} onDismiss={onDismiss} busyId={busyId} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Shortlist saved={saved} onDetails={onSelect} />
        </>
      )}

      <DetailDrawer
        item={selected}
        onClose={onDeselect}
        onToggleSave={onToggleSave}
        onTrackingSaved={onTrackingSaved}
        onError={onActionError}
        busy={selected ? busyId === selected.job.id : false}
      />
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  function search(event: FormEvent) {
    event.preventDefault();
    setPatches({});
    setSelectedId(null);
    setApplied({ ...form });
    setFiltersOpen(false);
  }

  function useDemo() {
    const next = { ...form, source: "demo" as const };
    setForm(next);
    setPatches({});
    setApplied(next);
  }

  function backToLive() {
    const next = { ...form, source: "live" as const };
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
    <div className="space-y-5 nx-stagger">
      {/* Header */}
      <div>
        <h1
          className="font-display text-slate-900"
          style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}
        >
          Job Discovery
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Opportunities ranked by an explainable match with your GitHub evidence and resume.{" "}
          <Link to="/preferences" className="font-medium text-indigo-700 hover:underline">
            Set preferences
          </Link>
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        {/* Filter rail (collapsible below lg) */}
        <div className="space-y-3 lg:sticky lg:top-6">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 lg:hidden"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-700" aria-hidden="true" />
              Filters
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <div className={`${filtersOpen ? "" : "hidden"} lg:block`}>
            <FilterRail form={form} set={set} onSubmit={search} onBackToLive={backToLive} />
          </div>
        </div>

        {/* Results */}
        <div className="min-w-0 space-y-5">
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
        </div>
      </div>

      {actionError && (
        <div role="alert" className="nx-card rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {describeError(actionError)}
        </div>
      )}
    </div>
  );
}
