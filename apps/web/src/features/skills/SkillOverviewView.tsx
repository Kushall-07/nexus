import { Link } from "react-router-dom";
import type { ResourceState } from "../../hooks/useApiResource";
import type { SkillOverview, SkillOverviewItem } from "../../api/types";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { ScoreMeter, unavailableLabel } from "../../components/ScoreMeter";
import { primaryButtonClass } from "../career/jobParts";

export interface ScoringRunState {
  busy: boolean;
  message: string | null;
}

interface Props {
  state: ResourceState<SkillOverview>;
  onRetry: () => void;
  onRunScoring?: () => void;
  scoring?: ScoringRunState;
}

function SkillCard({ skill }: { skill: SkillOverviewItem }) {
  const accentClass =
    skill.status !== "scored" || skill.score === null
      ? ""
      : skill.score >= 60
        ? "nx-panel-success"
        : skill.score >= 30
          ? "nx-panel-warning"
          : "nx-panel-danger";

  return (
    <li>
      <Link
        to={`/skills/${skill.id}`}
        className={`block rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${accentClass}`}
      >
        <span className="block font-semibold text-slate-900 leading-snug">{skill.displayName}</span>
        <span className="mt-1.5 block">
          <ScoreMeter score={skill.score} unavailableLabel={unavailableLabel(skill.status)} />
        </span>
        {skill.status === "scored" ? (
          <span className="mt-1 block text-xs text-slate-500">
            {skill.repositoryCount} contributing {skill.repositoryCount === 1 ? "repository" : "repositories"}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function SkillOverviewView({ state, onRetry, onRunScoring, scoring }: Props) {
  if (state.status === "loading") return <LoadingState label="Loading your skills..." />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={onRetry} />;

  const { analysis, categories } = state.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Skill Intelligence</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Evidence Scores summarise observable signals in your analyzed public repositories. They are not proof of
          expertise — a skill without evidence has simply not been observed.
        </p>
      </header>

      {analysis ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 nx-panel">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Latest analysis: </span>
            {new Date(analysis.createdAt).toISOString().slice(0, 10)}
            {" · "}
            <span className="tabular-nums">{analysis.repositoryCount}</span>{" "}
            {analysis.repositoryCount === 1 ? "repository" : "repositories"}
            {" · "}
            <span className="tabular-nums">{analysis.evidenceCount}</span> evidence items
            {" · "}scoring v{analysis.scoringVersion}
          </p>
        </div>
      ) : (
        <EmptyState title="Not yet analyzed">
          <p>
            No scoring run exists yet.{" "}
            <Link to="/repositories" className="underline text-indigo-700">Select and analyze your repositories</Link>,
            then score the collected evidence.
          </p>
        </EmptyState>
      )}

      {onRunScoring ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRunScoring}
            disabled={scoring?.busy}
            className={primaryButtonClass}
          >
            {scoring?.busy ? "Scoring…" : analysis ? "Re-score collected evidence" : "Score collected evidence"}
          </button>
          {scoring?.message ? (
            <p role="status" className="text-sm text-slate-600">
              {scoring.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-8">
        {categories.map((category) => {
          const scored = category.skills.filter((skill) => skill.status === "scored").length;

          return (
            <section key={category.id} aria-labelledby={`category-${category.id}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id={`category-${category.id}`} className="text-base font-semibold text-slate-900">
                  {category.displayName}
                </h2>
                {analysis ? (
                  <span className="text-xs text-slate-500 tabular-nums">
                    {scored} / {category.skills.length} scored
                  </span>
                ) : null}
              </div>
              {analysis && scored === 0 ? (
                <p className="mb-2 text-sm text-slate-500">
                  No evidence available for any skill in this category.
                </p>
              ) : null}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.skills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
