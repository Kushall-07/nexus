import { Link } from "react-router-dom";
import type { ApiError } from "../../api/client";
import type { GithubQuota, RepositoryDto, ScoringRunSummary } from "../../api/types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";

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

const buttonClass =
  "rounded-md bg-indigo-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2";
const secondaryClass =
  "rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2";

function entryLabel(entry: AnalysisEntry): string {
  switch (entry.status) {
    case "queued":
      return "Waiting to be analyzed";
    case "running":
      return "Analyzing...";
    case "success":
      return "Analysis succeeded";
    case "failed":
      return `Analysis failed: ${entry.message}`;
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

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={repository.selected}
          disabled={disabled}
          onChange={onToggle}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="font-medium text-slate-900">
            {repository.fullName}
          </label>
          {repository.description ? <p className="text-sm text-slate-700">{repository.description}</p> : null}
          <p className="mt-1 text-xs text-slate-600">
            {repository.primaryLanguage ?? "No primary language"}
            {repository.isFork ? " · Fork" : ""}
            {repository.isArchived ? " · Archived" : ""}
            {" · "}
            {repository.analyzed ? "Analyzed" : "Not yet analyzed"}
          </p>
          {entry ? (
            <p role="status" className={`mt-1 text-xs font-medium ${entry.status === "failed" ? "text-red-800" : "text-slate-800"}`}>
              {entryLabel(entry)}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ScoringFeedback({ scoring }: { scoring: ScoringState }) {
  if (scoring.status === "running") return <p role="status" className="text-sm text-slate-700">Scoring collected evidence...</p>;

  if (scoring.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
        {scoring.error.code === "NO_EVIDENCE"
          ? "No evidence is available to score yet. Select and analyze at least one repository first."
          : `Scoring failed: ${describeError(scoring.error)}`}
      </div>
    );
  }

  if (scoring.status === "done") {
    const { summary } = scoring;
    return (
      <div role="status" className="rounded-lg border border-green-700 bg-green-50 p-3 text-sm text-green-900">
        <p>
          Scored {summary.scoredSkillCount} {summary.scoredSkillCount === 1 ? "skill" : "skills"} from{" "}
          {summary.evidenceCount} evidence items across {summary.repositoryCount}{" "}
          {summary.repositoryCount === 1 ? "repository" : "repositories"}.
          {summary.skippedRepositoryCount > 0
            ? ` ${summary.skippedRepositoryCount} analyzed ${summary.skippedRepositoryCount === 1 ? "repository was" : "repositories were"} skipped; re-analyze to include them.`
            : ""}
        </p>
        <p className="mt-2 space-x-4">
          <Link to="/" className="font-medium underline">View Skill Graph</Link>
          <Link to="/roles" className="font-medium underline">Choose a Target Role</Link>
        </p>
      </div>
    );
  }

  return null;
}

export function RepositoriesView(props: Props) {
  const { list, quota, maxSelected, pending, progress, scoring } = props;

  if (list.status === "loading") return <LoadingState label="Discovering your public repositories..." />;
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
        <h1 className="text-2xl font-semibold text-slate-900">Repositories</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          NEXUS reads only your public repositories. Select up to {maxSelected}, analyze them, then score the collected
          evidence.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={props.onRefresh} disabled={batchRunning} className={secondaryClass}>
          Refresh repositories
        </button>
        <p className="text-sm text-slate-700">
          {quota
            ? `GitHub API quota: ${quota.remaining} of ${quota.limit} requests remaining (resets ${new Date(quota.resetAt).toISOString().slice(11, 16)} UTC)`
            : "GitHub API quota unavailable"}
        </p>
      </div>

      {props.truncated ? (
        <p className="text-sm text-amber-900">
          Only the first batch of repositories was discovered; some repositories may not be listed.
        </p>
      ) : null}

      {repositories.length === 0 ? (
        <EmptyState title="No public repositories found">
          NEXUS found no public repositories on your GitHub account, so there is nothing to analyze.
        </EmptyState>
      ) : (
        <>
          <p aria-live="polite" className="text-sm font-medium text-slate-900">
            {selected.length} of {maxSelected} repositories selected
            {atLimit ? " (limit reached; deselect one to choose another)" : ""}
          </p>
          {props.selectionError ? (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900">
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

          <section aria-labelledby="analyze-heading" className="space-y-3">
            <h2 id="analyze-heading" className="text-lg font-semibold text-slate-900">Analyze and score</h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={props.onAnalyze}
                disabled={batchRunning || toAnalyze.length === 0}
                className={buttonClass}
              >
                {batchRunning ? "Analyzing..." : "Analyze selected repositories"}
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={props.reanalyze}
                  disabled={batchRunning}
                  onChange={(event) => props.onReanalyzeChange(event.target.checked)}
                />
                Also re-analyze already analyzed repositories
              </label>
            </div>
            {selected.length === 0 ? (
              <p className="text-sm text-slate-600">Select at least one repository to analyze.</p>
            ) : toAnalyze.length === 0 ? (
              <p className="text-sm text-slate-600">All selected repositories are already analyzed.</p>
            ) : (
              <p className="text-sm text-slate-600">
                {toAnalyze.length} {toAnalyze.length === 1 ? "repository" : "repositories"} will be analyzed one at a
                time, each using GitHub API quota.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={props.onScore}
                disabled={batchRunning || scoring.status === "running" || !anyAnalyzed}
                className={buttonClass}
              >
                Score collected evidence
              </button>
              {!anyAnalyzed ? <p className="text-sm text-slate-600">Analyze a repository before scoring.</p> : null}
            </div>
            <ScoringFeedback scoring={scoring} />
          </section>
        </>
      )}
    </div>
  );
}
