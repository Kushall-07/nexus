import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ExternalLink as ExternalIcon, GitFork, RefreshCw, Search, Star, X } from "lucide-react";
import type { ApiError } from "../../api/client";
import type { GithubQuota, RepositoryDto, RepositorySyncSummary, ScoringRunSummary } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { buttonClass, focusRing, inputClass, primaryButtonClass } from "../career/jobParts";
import { CountUp, HeroGlow, Ring, heroShell } from "../career/spotlight";
import { aggregateLanguages } from "./languages";

// ── State types ────────────────────────────────────────────────────────────────

export type ListState =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "success"; repositories: RepositoryDto[] };

export type AnalysisEntry =
  | { status: "queued" }
  | { status: "running" }
  | { status: "success" }
  | { status: "failed"; message: string };

export interface AnalysisProgress {
  running: boolean;
  entries: Record<string, AnalysisEntry>;
}

export type ScoringState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; summary: ScoringRunSummary }
  | { status: "error"; error: ApiError };

export type RefreshState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; syncedAt: string; sync: RepositorySyncSummary }
  | { status: "error"; error: ApiError };

// ── Helpers ────────────────────────────────────────────────────────────────────

function entryLabel(entry: AnalysisEntry): string {
  switch (entry.status) {
    case "queued": return "Waiting to be analyzed";
    case "running": return "Analyzing...";
    case "success": return "Analysis succeeded";
    case "failed": return `Analysis failed: ${entry.message}`;
  }
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Languages ─────────────────────────────────────────────────────────────────

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1c40f",
  Python: "#2ea083", // GitHub's blue is too close to TypeScript's on the stacked bar
  "Jupyter Notebook": "#DA5B0B",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#8a8a8a",
  "C#": "#178600",
  Ruby: "#cc342d",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#7a54b8",
  Shell: "#6cc24a",
  Dockerfile: "#5b7b88",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Other: "#94a3b8",
};
const colorOf = (language: string) => LANGUAGE_COLORS[language] ?? "#94a3b8";

/** Whole percent, but never show a real, non-zero share as "0%". */
function formatPct(pct: number): string {
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

function LanguageDot({ language }: { language: string }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(language) }} />;
}

/** Thin stacked bar for a row; the segment names are in the tooltips. */
function MiniLanguageBar({ percentages }: { percentages: Record<string, number> | undefined }) {
  const entries = percentages ? Object.entries(percentages).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  if (entries.length === 0) return null;
  return (
    <div
      role="img"
      aria-label={`Languages: ${entries.map(([name, pct]) => `${name} ${pct}%`).join(", ")}`}
      className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
    >
      {entries.map(([name, pct]) => (
        <div key={name} style={{ width: `${pct}%`, backgroundColor: colorOf(name) }} title={`${name} ${pct}%`} />
      ))}
    </div>
  );
}

// ── Atlas hero ────────────────────────────────────────────────────────────────

type StepState = "done" | "now" | "todo";

function PipelineChips({ steps }: { steps: Array<{ label: string; state: StepState }> }) {
  return (
    <ol aria-label="Evidence pipeline" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-1">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              step.state === "done" && "bg-white/15 text-white",
              step.state === "now" && "bg-[oklch(62%_0.17_36)] text-white shadow-[0_0_0_4px_oklch(70%_0.148_36_/_0.22)]",
              step.state === "todo" && "border border-white/20 text-indigo-200",
            ].filter(Boolean).join(" ")}
            aria-current={step.state === "now" ? "step" : undefined}
          >
            {step.state === "done" ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true" className="text-[10px]">{i + 1}</span>}
            {step.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-white/25" />}
        </li>
      ))}
    </ol>
  );
}

function AtlasStat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-200">{label}</p>
      <p className="font-display mt-1 text-[1.9rem] leading-none tabular-nums text-[var(--color-indigo-950)]">{value}</p>
      {detail ? <div className="mt-2 text-xs text-indigo-100/80">{detail}</div> : null}
    </div>
  );
}

function AtlasHero({
  repositories,
  selectedCount,
  maxSelected,
  quota,
  syncedAt,
  steps,
  isRefreshing,
  batchRunning,
  onRefresh,
}: {
  repositories: RepositoryDto[];
  selectedCount: number;
  maxSelected: number;
  quota: GithubQuota | null;
  syncedAt: string | null;
  steps: Array<{ label: string; state: StepState }>;
  isRefreshing: boolean;
  batchRunning: boolean;
  onRefresh: () => void;
}) {
  const selected = repositories.filter((r) => r.selected);
  const scope = selected.length > 0 ? selected : repositories;
  const mix = aggregateLanguages(scope); // byte-weighted — see languages.ts
  const languages = mix.shares;
  const big = languages.slice(0, 3);
  const rest = languages.slice(3);
  const analyzedCount = repositories.filter((r) => r.analyzed).length;
  const coverage = repositories.length > 0 ? Math.round((analyzedCount / repositories.length) * 100) : 0;
  let stars = 0;
  for (const repository of repositories) stars += repository.stars;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      aria-label="Evidence overview"
      className={`${heroShell} p-6 sm:p-8`}
    >
      <HeroGlow />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {/* Language mix — big percentages first */}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">
            Your language mix · by code size
          </p>

          {big.length === 0 ? (
            <div className="mt-3">
              <h2 className="font-display text-[2.4rem] leading-[0.95] tracking-tight text-[var(--color-indigo-950)]">Your evidence at a glance</h2>
              <p className="mt-2 max-w-md text-sm text-indigo-100/80">
                Language percentages appear here once your repositories report their languages.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-9 gap-y-4">
                {big.map((item, i) => (
                  <div key={item.name}>
                    <p
                      className="font-display leading-[0.82] tracking-tight text-[var(--color-indigo-950)]"
                      style={{ fontSize: i === 0 ? "5.6rem" : "3.6rem" }}
                    >
                      <CountUp value={Math.round(item.pct)} />
                      <span className="ml-0.5 text-[0.42em] text-indigo-200">%</span>
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-indigo-50">
                      <LanguageDot language={item.name} />
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex h-3.5 w-full overflow-hidden rounded-full bg-white/15" role="img" aria-label={`Language mix: ${languages.map((l) => `${l.name} ${formatPct(l.pct)}`).join(", ")}`}>
                {languages.map((item, i) => (
                  <motion.span
                    key={item.name}
                    title={`${item.name} ${formatPct(item.pct)}`}
                    className="block h-full"
                    style={{ backgroundColor: colorOf(item.name) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>

              <p className="mt-3 text-xs text-indigo-100/75">
                Share of all code bytes in {mix.repositoriesCounted} {mix.repositoriesCounted === 1 ? "repository" : "repositories"}
                {selected.length > 0 ? " you selected" : ""}.
                {mix.repositoriesWithoutData > 0
                  ? ` ${mix.repositoriesWithoutData} ${mix.repositoriesWithoutData === 1 ? "has" : "have"} no language data yet — analyze ${mix.repositoriesWithoutData === 1 ? "it" : "them"} to include ${mix.repositoriesWithoutData === 1 ? "it" : "them"}.`
                  : ""}
              </p>

              {rest.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {rest.map((item) => (
                    <li key={item.name} className="flex items-center gap-1.5 text-xs text-indigo-100/85">
                      <LanguageDot language={item.name} />
                      {item.name}
                      <span className="tabular-nums text-indigo-200">{formatPct(item.pct)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* API quota ring */}
        <div className="flex flex-col items-center gap-2.5 lg:min-w-[11.5rem]">
          {quota ? (
            <>
              <Ring progress={quota.limit > 0 ? quota.remaining / quota.limit : 0} size={150}>
                <span className="text-center">
                  <span className="font-display block text-[2.4rem] leading-none tabular-nums text-[var(--color-indigo-950)]">{quota.remaining}</span>
                  <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-indigo-200">of {quota.limit}</span>
                </span>
              </Ring>
              <p className="text-xs tabular-nums text-indigo-100/85">
                {quota.remaining} of {quota.limit} requests remaining
              </p>
            </>
          ) : (
            <>
              <Ring progress={0} size={150}>
                <span className="font-display text-[2.4rem] leading-none text-indigo-200">—</span>
              </Ring>
              <p className="text-xs text-indigo-100/85">GitHub API quota unavailable</p>
            </>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={batchRunning || isRefreshing}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Syncing…" : "Refresh repositories"}
          </button>
        </div>
      </div>

      {/* Auxiliary atlas: stats + pipeline */}
      <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AtlasStat label="Repositories" value={repositories.length} detail={syncedAt ? <>Synced {formatSyncTime(syncedAt)}</> : null} />
        <AtlasStat
          label="Analyzed"
          value={analyzedCount}
          detail={
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-[oklch(70%_0.148_36)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${coverage}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </div>
              <span className="mt-1 block tabular-nums">{coverage}% coverage</span>
            </div>
          }
        />
        <AtlasStat label="Selected" value={`${selectedCount} / ${maxSelected}`} detail="Repositories to analyze" />
        <AtlasStat label="Stars" value={stars.toLocaleString()} detail="Across all repositories" />
      </div>
      <div className="relative mt-5">
        <PipelineChips steps={steps} />
      </div>
    </motion.section>
  );
}

// ── Sync status banner ────────────────────────────────────────────────────────

function SyncBanner({ refresh }: { refresh: RefreshState }) {
  if (refresh.status === "loading") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800"
      >
        <span className="inline-block h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" aria-hidden="true" />
        Fetching repositories from GitHub…
      </div>
    );
  }

  if (refresh.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        Refresh failed: {describeError(refresh.error)}. Your existing repositories are shown below.
      </div>
    );
  }

  if (refresh.status === "success") {
    const { sync, syncedAt } = refresh;
    const newCount = sync.inserted;

    if (newCount > 0) {
      return (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            Sync complete · <span className="font-semibold">{newCount} new {newCount === 1 ? "repository" : "repositories"} discovered</span>
            {sync.updated > 0 ? `, ${sync.updated} updated` : ""}
            {" "}· {formatSyncTime(syncedAt)}
          </span>
        </div>
      );
    }

    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
      >
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
        Sync complete · {sync.discovered} {sync.discovered === 1 ? "repository" : "repositories"} · no new repositories · {formatSyncTime(syncedAt)}
      </div>
    );
  }

  return null;
}

// ── Scoring feedback ──────────────────────────────────────────────────────────

function ScoringFeedback({ scoring }: { scoring: ScoringState }) {
  if (scoring.status === "running") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-700" aria-hidden="true" />
        Scoring collected evidence…
      </p>
    );
  }

  if (scoring.status === "error") {
    return (
      <div role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
        {scoring.error.code === "NO_EVIDENCE"
          ? "No evidence is available to score yet. Select and analyze at least one repository first."
          : `Scoring failed: ${describeError(scoring.error)}`}
      </div>
    );
  }

  if (scoring.status === "done") {
    const { summary } = scoring;
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p>
          Scored {summary.scoredSkillCount} {summary.scoredSkillCount === 1 ? "skill" : "skills"} from{" "}
          {summary.evidenceCount} evidence items across {summary.repositoryCount}{" "}
          {summary.repositoryCount === 1 ? "repository" : "repositories"}.
          {summary.skippedRepositoryCount > 0
            ? ` ${summary.skippedRepositoryCount} analyzed ${summary.skippedRepositoryCount === 1 ? "repository was" : "repositories were"} skipped; re-analyze to include them.`
            : ""}
        </p>
        <p className="mt-2 flex gap-4">
          <Link to="/skills" className="font-semibold underline text-emerald-900 hover:text-emerald-700">View Skill Graph</Link>
          <Link to="/roles" className="font-semibold underline text-emerald-900 hover:text-emerald-700">Choose a Target Role</Link>
        </p>
      </div>
    );
  }

  return null;
}

// ── Repository row ────────────────────────────────────────────────────────────

const ROW_GRID = "md:grid-cols-[1.25rem_minmax(0,2.4fr)_minmax(0,1.3fr)_6rem_minmax(0,1.2fr)]";

function RepositoryRow({
  repository,
  disabled,
  entry,
  onToggle,
}: {
  repository: RepositoryDto;
  disabled: boolean;
  entry?: AnalysisEntry;
  onToggle: () => void;
}) {
  const inputId = `repo-${repository.id}`;
  const accent =
    entry?.status === "failed" ? "border-l-red-400"
    : entry?.status === "running" ? "border-l-[oklch(62%_0.17_36)]"
    : repository.selected ? "border-l-indigo-700"
    : "border-l-transparent";

  return (
    <li
      className={[
        "grid items-center gap-x-4 gap-y-2 border-l-4 px-4 py-3.5 transition-colors",
        "grid-cols-[1.25rem_minmax(0,1fr)]", ROW_GRID,
        accent,
        repository.selected ? "bg-gradient-to-r from-indigo-50/70 to-transparent" : "hover:bg-slate-50/70",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={repository.selected}
        disabled={disabled}
        onChange={onToggle}
        className={["h-4 w-4 flex-shrink-0 self-start rounded border-slate-300 text-indigo-700 md:self-center", focusRing].join(" ")}
      />

      {/* Repository */}
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <label htmlFor={inputId} className="min-w-0 cursor-pointer break-words font-semibold leading-snug text-slate-900 transition-colors hover:text-indigo-700">
            {repository.fullName}
          </label>
          <a
            href={repository.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${repository.fullName} on GitHub`}
            className={["mt-0.5 flex-shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-indigo-700", focusRing].join(" ")}
          >
            <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        {repository.description ? (
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{repository.description}</p>
        ) : (
          <p className="mt-0.5 text-sm italic text-slate-400">No description</p>
        )}
        {(repository.isFork || repository.isArchived) && (
          <div className="mt-1.5 flex gap-1.5">
            {repository.isFork && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">Fork</span>
            )}
            {repository.isArchived && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Archived</span>
            )}
          </div>
        )}
      </div>

      {/* Languages */}
      <div className="col-start-2 min-w-0 md:col-start-auto">
        {repository.primaryLanguage ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <LanguageDot language={repository.primaryLanguage} />
            {repository.primaryLanguage}
          </span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
        <MiniLanguageBar percentages={repository.languagePercentages} />
      </div>

      {/* Activity */}
      <div className="col-start-2 flex items-center gap-3 text-xs text-slate-500 md:col-start-auto md:flex-col md:items-start md:gap-0.5">
        <span className="flex items-center gap-1 tabular-nums"><Star className="h-3 w-3" aria-hidden="true" />{repository.stars.toLocaleString()}</span>
        {repository.forks > 0 && (
          <span className="flex items-center gap-1 tabular-nums"><GitFork className="h-3 w-3" aria-hidden="true" />{repository.forks.toLocaleString()}</span>
        )}
        {repository.githubPushedAt && <span className="text-slate-400">{formatRelativeDate(repository.githubPushedAt)}</span>}
      </div>

      {/* Status */}
      <div className="col-start-2 min-w-0 md:col-start-auto">
        {repository.analyzed ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            <Check className="h-3 w-3" aria-hidden="true" />
            Analyzed
            {repository.analyzedAt ? <span className="font-normal text-indigo-700/70">· {formatRelativeDate(repository.analyzedAt)}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not yet analyzed</span>
        )}
        {entry ? (
          <p
            role="status"
            className={["mt-1 text-xs font-medium", entry.status === "failed" ? "text-red-700" : "text-indigo-700"].join(" ")}
          >
            {entryLabel(entry)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface Props {
  list: ListState;
  truncated: boolean;
  quota: GithubQuota | null;
  maxSelected: number;
  pending: ReadonlySet<string>;
  selectionError: string | null;
  progress: AnalysisProgress;
  reanalyze: boolean;
  scoring: ScoringState;
  refresh: RefreshState;
  onToggle: (repository: RepositoryDto) => void;
  onRefresh: () => void;
  onReanalyzeChange: (value: boolean) => void;
  onAnalyze: () => void;
  onScore: () => void;
}

type StatusFilter = "all" | "selected" | "analyzed" | "pending";
type SortKey = "updated" | "stars" | "name";

export function RepositoriesView(props: Props) {
  const { list, quota, maxSelected, pending, progress, scoring, refresh } = props;
  const { state: authState } = useAuth();
  const username = authState.status === "authenticated" ? authState.user.username : null;

  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const isRefreshing = refresh.status === "loading";

  if (list.status === "loading") return <LoadingState label="Discovering your public repositories…" />;
  if (list.status === "error") return <ErrorState error={list.error} onRetry={props.onRefresh} />;

  const repositories = list.repositories;
  const selected = repositories.filter((repo) => repo.selected);
  const analyzed = repositories.filter((repo) => repo.analyzed);
  const toAnalyze = selected.filter((repo) => props.reanalyze || !repo.analyzed);
  const atLimit = selected.length >= maxSelected;
  const anyAnalyzed = repositories.some((repo) => repo.analyzed);
  const batchRunning = progress.running;

  // ── Filter + sort (client side, over the loaded list) ──
  const languages = Array.from(new Set(repositories.map((r) => r.primaryLanguage).filter((l): l is string => !!l))).sort();
  const needle = query.trim().toLowerCase();
  const visible = repositories
    .filter((r) => {
      if (needle && !`${r.fullName} ${r.description ?? ""}`.toLowerCase().includes(needle)) return false;
      if (language && r.primaryLanguage !== language) return false;
      if (status === "selected" && !r.selected) return false;
      if (status === "analyzed" && !r.analyzed) return false;
      if (status === "pending" && r.analyzed) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "stars") return b.stars - a.stars;
      if (sort === "name") return a.fullName.localeCompare(b.fullName);
      return (Date.parse(b.githubPushedAt ?? "") || 0) - (Date.parse(a.githubPushedAt ?? "") || 0);
    });
  const filtering = needle !== "" || language !== "" || status !== "all";

  // ── Overall analysis progress ──
  const entries = Object.values(progress.entries);
  const doneCount = entries.filter((e) => e.status === "success" || e.status === "failed").length;

  // ── Pipeline chips ──
  const syncedAt = refresh.status === "success" ? refresh.syncedAt : null;
  const scored = scoring.status === "done";
  const analyzeDone = selected.length > 0 && toAnalyze.length === 0;
  const steps: Array<{ label: string; state: StepState }> = [
    { label: "Sync", state: "done" },
    { label: "Select", state: selected.length > 0 ? "done" : "now" },
    { label: "Analyze", state: analyzeDone ? "done" : selected.length > 0 ? "now" : "todo" },
    { label: "Score", state: scored ? "done" : analyzeDone || anyAnalyzed ? "now" : "todo" },
  ];

  const selectClass = `${inputClass} !w-auto !py-2`;

  return (
    <div className="space-y-6 nx-stagger">
      {/* Header */}
      <header>
        <h1 className="font-display text-slate-900" style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
          GitHub Evidence
        </h1>
        {username ? (
          <p className="mt-2 text-sm text-slate-500">
            Connected as <span className="font-semibold text-slate-700">@{username}</span>
            {" · "}Public repositories only
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Public repositories only</p>
        )}
      </header>

      {/* Language atlas */}
      <AtlasHero
        repositories={repositories}
        selectedCount={selected.length}
        maxSelected={maxSelected}
        quota={quota}
        syncedAt={syncedAt}
        steps={steps}
        isRefreshing={isRefreshing}
        batchRunning={batchRunning}
        onRefresh={props.onRefresh}
      />

      <SyncBanner refresh={refresh} />

      {props.truncated ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Only the first batch of repositories was discovered. Your account has more than 300 public repositories — not all are listed.
        </p>
      ) : null}

      {repositories.length === 0 ? (
        <EmptyState title="No public repositories found">
          NEXUS found no public repositories on your GitHub account. Create a public repository or check your GitHub connection in Settings.
        </EmptyState>
      ) : (
        <>
          {/* Command bar */}
          <section
            aria-labelledby="analyze-heading"
            className="z-20 md:sticky md:top-14 lg:top-4"
          >
            <h2 id="analyze-heading" className="sr-only">Find, analyze and score repositories</h2>
            <div className="nx-card space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-[0_18px_40px_-24px_rgba(14,79,74,0.45)] backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Search repositories"
                    placeholder="Search repositories"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={`${inputClass} !pl-9`}
                  />
                </div>
                <select aria-label="Filter by language" className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="">All languages</option>
                  {languages.map((l) => (
                    <option key={l} value={l}>{l} ({repositories.filter((r) => r.primaryLanguage === l).length})</option>
                  ))}
                </select>
                <select aria-label="Filter by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                  <option value="all">All repositories</option>
                  <option value="selected">Selected</option>
                  <option value="analyzed">Analyzed</option>
                  <option value="pending">Not analyzed</option>
                </select>
                <select aria-label="Sort repositories" className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="updated">Recently updated</option>
                  <option value="stars">Most stars</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label="Repositories selected"
                      aria-valuemin={0}
                      aria-valuemax={maxSelected}
                      aria-valuenow={selected.length}
                      className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div className="nx-score-fill h-full rounded-full" style={{ width: `${(selected.length / maxSelected) * 100}%` }} />
                    </div>
                    {entries.length > 0 ? (
                      <span className="text-xs font-semibold tabular-nums text-indigo-700">{doneCount} of {entries.length} done</span>
                    ) : null}
                  </div>
                  {selected.length === 0 ? (
                    <p className="text-sm text-slate-500">Select at least one repository to analyze.</p>
                  ) : toAnalyze.length === 0 ? (
                    <p className="text-sm text-slate-500">All selected repositories are already analyzed.</p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      <span className="tabular-nums font-medium text-slate-700">{toAnalyze.length}</span>{" "}
                      {toAnalyze.length === 1 ? "repository" : "repositories"} will be analyzed one at a time,
                      each spending GitHub API quota.
                    </p>
                  )}
                  {!anyAnalyzed ? <p className="text-sm text-slate-500">Analyze a repository before scoring.</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={props.reanalyze}
                      disabled={batchRunning}
                      onChange={(event) => props.onReanalyzeChange(event.target.checked)}
                      className={["rounded border-slate-300 text-indigo-700", focusRing].join(" ")}
                    />
                    Re-analyze already analyzed repositories
                  </label>
                  <button
                    type="button"
                    onClick={props.onAnalyze}
                    disabled={batchRunning || toAnalyze.length === 0}
                    className={primaryButtonClass}
                    style={{ color: "var(--color-indigo-950)" }}
                  >
                    {batchRunning ? "Analyzing..." : "Analyze selected repositories"}
                  </button>
                  <button
                    type="button"
                    onClick={props.onScore}
                    disabled={batchRunning || scoring.status === "running" || !anyAnalyzed}
                    className={primaryButtonClass}
                    style={{ color: "var(--color-indigo-950)" }}
                  >
                    Score collected evidence
                  </button>
                </div>
              </div>
            </div>
          </section>

          <ScoringFeedback scoring={scoring} />

          {/* Repository table */}
          <section aria-labelledby="repos-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="repos-heading" className="text-sm font-semibold text-slate-700">
                {filtering
                  ? `${visible.length} of ${repositories.length} ${repositories.length === 1 ? "repository" : "repositories"}`
                  : `${repositories.length} ${repositories.length === 1 ? "repository" : "repositories"}`}
              </h2>
              <p aria-live="polite" className="text-xs tabular-nums text-slate-500">
                {selected.length} of {maxSelected} repositories selected
                {atLimit ? " (limit reached)" : ""}
              </p>
            </div>

            {props.selectionError ? (
              <div role="alert" className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900">
                {props.selectionError}
              </div>
            ) : null}

            <div className="nx-card overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div
                aria-hidden="true"
                className={`hidden gap-x-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 pl-5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid ${ROW_GRID}`}
              >
                <span />
                <span>Repository</span>
                <span>Language</span>
                <span>Activity</span>
                <span>Status</span>
              </div>

              {visible.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">No repositories match these filters.</p>
                  <button
                    type="button"
                    className={`${buttonClass} inline-flex items-center gap-1.5`}
                    onClick={() => { setQuery(""); setLanguage(""); setStatus("all"); }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear filters
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100" role="list">
                  {visible.map((repository) => (
                    <RepositoryRow
                      key={repository.id}
                      repository={repository}
                      entry={progress.entries[repository.id]}
                      disabled={batchRunning || pending.has(repository.id) || (!repository.selected && atLimit)}
                      onToggle={() => props.onToggle(repository)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
