import { Link } from "react-router-dom";
import type { ResourceState } from "../../hooks/useApiResource";
import type { SkillOverview, SkillOverviewItem } from "../../api/types";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { ScoreMeter, unavailableLabel } from "../../components/ScoreMeter";

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
  return (
    <li>
      <Link
        to={`/skills/${skill.id}`}
        className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
      >
        <span className="block font-medium text-slate-900">{skill.displayName}</span>
        <span className="mt-1 block">
          <ScoreMeter score={skill.score} unavailableLabel={unavailableLabel(skill.status)} />
        </span>
        {skill.status === "scored" ? (
          <span className="mt-1 block text-xs text-slate-600">
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
        <h1 className="text-2xl font-semibold text-slate-900">Skill graph</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Evidence Scores summarise observable signals in your analyzed public repositories. They are not proof of
          expertise, and a skill without evidence has simply not been observed.
        </p>
      </header>

      {analysis ? (
        <p className="text-sm text-slate-700">
          Latest analysis: {new Date(analysis.createdAt).toISOString().slice(0, 10)} · {analysis.repositoryCount}{" "}
          {analysis.repositoryCount === 1 ? "repository" : "repositories"} · {analysis.evidenceCount} evidence items ·
          scoring v{analysis.scoringVersion}
        </p>
      ) : (
        <EmptyState title="Not yet analyzed">
          <p>No scoring run exists yet. Analyze your repositories, then score the collected evidence.</p>
        </EmptyState>
      )}

      {onRunScoring ? (
        <div>
          <button
            type="button"
            onClick={onRunScoring}
            disabled={scoring?.busy}
            className="rounded-md bg-indigo-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
          >
            {scoring?.busy ? "Scoring..." : analysis ? "Re-score collected evidence" : "Score collected evidence"}
          </button>
          {scoring?.message ? (
            <p role="status" className="mt-2 text-sm text-slate-700">
              {scoring.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-6">
        {categories.map((category) => {
          const scored = category.skills.filter((skill) => skill.status === "scored").length;

          return (
            <section key={category.id} aria-labelledby={`category-${category.id}`}>
              <h2 id={`category-${category.id}`} className="text-lg font-semibold text-slate-900">
                {category.displayName}
              </h2>
              {analysis && scored === 0 ? (
                <p className="mt-1 text-sm text-slate-600">No evidence available for any skill in this category.</p>
              ) : null}
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
