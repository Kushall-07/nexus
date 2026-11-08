import { Link } from "react-router-dom";
import type { ApiError } from "../../api/client";
import type { GithubQuota, RepositoryDto, ScoringRunSummary } from "../../api/types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { buttonClass, primaryButtonClass } from "../career/jobParts";

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
  onToggle: (repository: RepositoryDto) => void;
  onRefresh: () => void;
  onReanalyzeChange: (value: boolean) => void;
  onAnalyze: () => void;
  onScore: () => void;
}

function entryLabel(entry: AnalysisEntry): string {
  switch (entry.status) {
    case "queued": return "Waiting to be analyzed";
    case "running": return "Analyzing...";
    case "success": return "Analysis succeeded";
    case "failed": return `Analysis failed: ${entry.message}`;
  }
}

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
  const entryAccent =
    entry?.status === "success"
      ? "nx-panel-success"
      : entry?.status === "failed"
        ? "nx-panel-danger"
        : entry?.status === "running"
          ? "nx-panel"
          : "";

  return (
    <li className={`rounded-xl border border-slate-200 bg-white p-3.5 ${entryAccent}`}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={repository.selected}
          disabled={disabled}
          onChange={onToggle}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="font-semibold text-slate-900 cursor-pointer">
            {repository.fullName}
          </label>
          {repository.description ? (
            <p className="mt-0.5 text-sm text-slate-600">{repository.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            {repository.primaryLanguage ?? "No primary language"}
            {repository.isFork ? " · Fork" : ""}
            {repository.isArchived ? " · Archived" : ""}
            {" · "}
            {repository.analyzed ? "Analyzed" : "Not yet analyzed"}
          </p>
          {entry ? (
            <p
              role="status"
              className={`mt-1 text-xs font-medium ${entry.status === "failed" ? "text-red-800" : "text-slate-700"}`}
            >
              {entryLabel(entry)}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

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
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 nx-panel-success px-4 py-3 text-sm text-emerald-900">
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

export function RepositoriesView(props: Props) {
  const { list, quota, maxSelected, pending, progress, scoring } = props;

  if (list.status === "loading") return <LoadingState label="Discovering your public repositories…" />;
  if (list.status === "error") return <ErrorState error={list.error} onRetry={props.onRefresh} />;

  const repositories = list.repositories;
  const selected = repositories.filter((repo) => repo.selected);
  const toAnalyze = selected.filter((repo) => props.reanalyze || !repo.analyzed);
  const atLimit = selected.length >= maxSelected;
  const anyAnalyzed = repositories.some((repo) => repo.analyzed);
  const batchRunning = progress.running;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>GitHub Evidence</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          NEXUS reads only your public repositories. Select up to {maxSelected}, analyze them, then score the
          collected evidence into a Skill Graph.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={batchRunning}
          className={buttonClass}
        >
          Refresh repositories
        </button>
        <p className="text-sm text-slate-500">
          {quota
            ? `GitHub API quota: ${quota.remaining} of ${quota.limit} requests remaining (resets ${new Date(quota.resetAt).toISOString().slice(11, 16)} UTC)`
            : "GitHub API quota unavailable"}
        </p>
      </div>

      {props.truncated ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Only the first batch of repositories was discovered; some repositories may not be listed.
        </p>
      ) : null}

      {repositories.length === 0 ? (
        <EmptyState title="No public repositories found">
          NEXUS found no public repositories on your GitHub account, so there is nothing to analyze.
        </EmptyState>
      ) : (
        <>
          <p aria-live="polite" className="text-sm font-medium text-slate-700 tabular-nums">
            {selected.length} of {maxSelected} repositories selected
            {atLimit ? " (limit reached; deselect one to choose another)" : ""}
          </p>

          {props.selectionError ? (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-2.5 text-sm text-red-900">
              {props.selectionError}
            </p>
          ) : null}

          <ul className="space-y-2">
            {repositories.map((repository) => (
              <RepositoryRow
                key={repository.id}
                repository={repository}
                entry={progress.entries[repository.id]}
                disabled={batchRunning || pending.has(repository.id) || (!repository.selected && atLimit)}
                onToggle={() => props.onToggle(repository)}
              />
            ))}
          </ul>

          <section aria-labelledby="analyze-heading" className="space-y-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <h2 id="analyze-heading" className="text-base font-semibold text-slate-900">Analyze and score</h2>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={props.onAnalyze}
                  disabled={batchRunning || toAnalyze.length === 0}
                  className={primaryButtonClass}
                >
                  {batchRunning ? "Analyzing..." : "Analyze selected repositories"}
                </button>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={props.reanalyze}
                    disabled={batchRunning}
                    onChange={(event) => props.onReanalyzeChange(event.target.checked)}
                  />
                  Re-analyze already analyzed repositories
                </label>
              </div>
              {selected.length === 0 ? (
                <p className="text-sm text-slate-500">Select at least one repository to analyze.</p>
              ) : toAnalyze.length === 0 ? (
                <p className="text-sm text-slate-500">All selected repositories are already analyzed.</p>
              ) : (
                <p className="text-sm text-slate-500">
                  <span className="tabular-nums font-medium text-slate-700">{toAnalyze.length}</span>{" "}
                  {toAnalyze.length === 1 ? "repository" : "repositories"} will be analyzed one at a time,
                  each using GitHub API quota.
                </p>
              )}
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={props.onScore}
                  disabled={batchRunning || scoring.status === "running" || !anyAnalyzed}
                  className={primaryButtonClass}
                >
                  Score collected evidence
                </button>
                {!anyAnalyzed ? (
                  <p className="text-sm text-slate-500">Analyze a repository before scoring.</p>
                ) : null}
              </div>
              <ScoringFeedback scoring={scoring} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
