import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import type { ResourceState } from "../../hooks/useApiResource";
import type { SkillOverview, SkillOverviewItem } from "../../api/types";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { ScoreMeter, unavailableLabel } from "../../components/ScoreMeter";
import { SkillRadar, strongestScore } from "./SkillRadar";

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

/** Heat colour for a backend score: deeper teal means stronger evidence. */
function heat(score: number): { background: string; color: string } {
  const pct = Math.min(Math.max(score, 0), 100);
  const alpha = 0.14 + (pct / 100) * 0.82;
  return { background: `rgba(14, 79, 74, ${alpha.toFixed(2)})`, color: pct >= 45 ? "#FBF8F4" : "#0A2A27" };
}

const HATCH = "repeating-linear-gradient(135deg, oklch(90% 0.014 72) 0 6px, oklch(93% 0.012 72) 6px 12px)";

function isScored(skill: SkillOverviewItem): boolean {
  return skill.status === "scored" && skill.score !== null;
}

/** One heatmap cell. It is a real link, so a click or tap always opens the skill. */
function Cell({ skill, active, onPreview }: { skill: SkillOverviewItem; active: boolean; onPreview: () => void }) {
  const scored = isScored(skill);
  return (
    <Link
      to={`/skills/${skill.id}`}
      onMouseEnter={onPreview}
      onFocus={onPreview}
      className={`flex min-h-[4.5rem] flex-col justify-between gap-1 rounded-xl border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
        active ? "border-transparent ring-[3px] ring-[oklch(62%_0.17_36)] ring-offset-1" : "border-transparent"
      }`}
      style={scored ? heat(skill.score as number) : { background: HATCH, color: "oklch(40% 0.010 200)", borderColor: "oklch(86% 0.016 72)" }}
    >
      <span className="text-xs font-semibold leading-tight">{skill.displayName}</span>
      {scored ? (
        <span className="font-display text-xl leading-none tabular-nums">{(skill.score as number).toFixed(0)}</span>
      ) : (
        <span className="text-[0.65rem] leading-tight">{unavailableLabel(skill.status)}</span>
      )}
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="nx-card rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="font-display mt-1 text-3xl leading-none text-indigo-700 tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function SkillPreview({ skill, categoryName }: { skill: SkillOverviewItem; categoryName: string }) {
  const scored = isScored(skill);
  const pct = scored ? Math.min(Math.max(skill.score as number, 0), 100) : 0;
  return (
    <section aria-label="Skill preview" className="nx-card rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <span
          aria-hidden="true"
          className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full"
          style={{ background: scored ? `conic-gradient(var(--color-indigo-700) ${pct}%, oklch(88% 0.015 72) 0)` : HATCH }}
        >
          <span className="font-display grid h-[3.6rem] w-[3.6rem] place-items-center rounded-full bg-white text-2xl leading-none text-slate-900">
            {scored ? (skill.score as number).toFixed(0) : "—"}
          </span>
        </span>
        <div className="min-w-0 flex-1" style={{ flexBasis: "14rem" }}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{categoryName}</p>
          <h2 className="font-display mt-0.5 text-3xl leading-none text-slate-900">{skill.displayName}</h2>
          {scored ? (
            <>
              <div className="mt-2.5">
                <ScoreMeter score={skill.score} unavailableLabel={unavailableLabel(skill.status)} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {skill.repositoryCount} contributing {skill.repositoryCount === 1 ? "repository" : "repositories"}
              </p>
            </>
          ) : null}
        </div>
        <p className="max-w-[14rem] text-xs leading-relaxed text-slate-500">
          Hover or focus a cell to preview it. Open any cell to see how its score was built.
        </p>
      </div>
    </section>
  );
}

function Loaded({ data, onRunScoring, scoring }: { data: SkillOverview; onRunScoring?: () => void; scoring?: ScoringRunState }) {
  const { analysis, categories } = data;

  // Counts and the strongest skill are picks from backend scores, never recalculated.
  let first: SkillOverviewItem | null = null;
  let strongest: SkillOverviewItem | null = null;
  let totalSkills = 0;
  let scoredSkills = 0;
  let categoriesWithEvidence = 0;
  for (const category of categories) {
    let categoryScored = 0;
    for (const skill of category.skills) {
      totalSkills += 1;
      if (first === null) first = skill;
      if (isScored(skill)) {
        scoredSkills += 1;
        categoryScored += 1;
        if (strongest === null || (skill.score ?? 0) > (strongest.score ?? 0)) strongest = skill;
      }
    }
    if (categoryScored > 0) categoriesWithEvidence += 1;
  }

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [radarView, setRadarView] = useState("all");

  // Preview: the hovered / focused skill, else the strongest scored skill, else the first skill.
  let previewed: SkillOverviewItem | null = null;
  let previewedCategory = "";
  for (const category of categories) {
    for (const skill of category.skills) {
      if (skill.id === previewId) {
        previewed = skill;
        previewedCategory = category.displayName;
      }
    }
  }
  if (previewed === null) {
    previewed = strongest ?? first;
    for (const category of categories) {
      for (const skill of category.skills) {
        if (skill.id === previewed?.id) previewedCategory = category.displayName;
      }
    }
  }
  const previewedId = previewed?.id ?? null;

  return (
    <div className="space-y-6 nx-stagger">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-slate-900" style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
            Skill Intelligence
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500" style={{ lineHeight: 1.65 }}>
            Evidence Scores summarise observable signals in your analyzed public repositories. They are not proof of
            expertise — a skill without evidence has simply not been observed.
          </p>
        </div>
        {onRunScoring ? (
          <button type="button" onClick={onRunScoring} disabled={scoring?.busy} className="nx-btn nx-btn-coral">
            <RefreshCw className={`h-4 w-4 ${scoring?.busy ? "animate-spin" : ""}`} aria-hidden="true" />
            {scoring?.busy ? "Scoring…" : analysis ? "Re-score collected evidence" : "Score collected evidence"}
          </button>
        ) : null}
      </header>

      {scoring?.message ? (
        <p role="status" className="text-sm text-slate-600">
          {scoring.message}
        </p>
      ) : null}

      {analysis ? (
        <div className="nx-card rounded-2xl border border-slate-200 bg-white px-5 py-3.5 nx-panel">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Latest analysis:</span>
            <span className="tabular-nums">{new Date(analysis.createdAt).toISOString().slice(0, 10)}</span>
            <span className="text-slate-300">·</span>
            <span><span className="tabular-nums font-semibold text-slate-700">{analysis.repositoryCount}</span> {analysis.repositoryCount === 1 ? "repository" : "repositories"}</span>
            <span className="text-slate-300">·</span>
            <span><span className="tabular-nums font-semibold text-slate-700">{analysis.evidenceCount}</span> evidence items</span>
            <span className="text-slate-300">·</span>
            <span>scoring v{analysis.scoringVersion}</span>
          </div>
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

      {analysis ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Skills scored" value={`${scoredSkills} / ${totalSkills}`} hint="with observed evidence" />
          <Stat
            label="Strongest skill"
            value={strongest && strongest.score !== null ? strongest.score.toFixed(0) : "—"}
            hint={strongest ? strongest.displayName : "none scored yet"}
          />
          <Stat label="Categories with evidence" value={`${categoriesWithEvidence} / ${categories.length}`} hint="at least one scored skill" />
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(15rem,1fr)]">
        <div className="min-w-0 space-y-5">
          {previewed ? <SkillPreview skill={previewed} categoryName={previewedCategory} /> : null}
          <div className="nx-card rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl leading-none text-slate-900">Evidence heatmap</h2>
              <span className="flex items-center gap-2 text-[0.7rem] text-slate-500" aria-hidden="true">
                0
                <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, rgba(14,79,74,0.14), rgba(14,79,74,0.96))" }} />
                100
                <span className="ml-1 h-2.5 w-4 rounded-sm" style={{ background: HATCH }} />
                no evidence
              </span>
            </div>

            <div className="space-y-5">
              {categories.map((category) => {
                const scored = category.skills.filter((skill) => skill.status === "scored").length;
                const best = strongestScore(category.skills);
                return (
                  <section key={category.id} aria-labelledby={`category-${category.id}`}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <h3 id={`category-${category.id}`} className="text-sm font-semibold text-slate-900">
                        {category.displayName}
                      </h3>
                      {analysis ? (
                        <span className="text-xs text-slate-500 tabular-nums">
                          {scored} / {category.skills.length} scored{best !== null ? ` · strongest ${best.toFixed(0)}` : ""}
                        </span>
                      ) : null}
                    </div>
                    {analysis && scored === 0 ? (
                      <p className="mb-2 text-sm text-slate-500">
                        No evidence available for any skill in this category.
                      </p>
                    ) : null}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
                      {category.skills.map((skill) => (
                        <Cell key={skill.id} skill={skill} active={previewedId === skill.id} onPreview={() => setPreviewId(skill.id)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        <SkillRadar view={radarView} onViewChange={setRadarView} categories={categories} analyzed={analysis !== null} />
      </div>
    </div>
  );
}

export function SkillOverviewView({ state, onRetry, onRunScoring, scoring }: Props) {
  if (state.status === "loading") return <LoadingState label="Loading your skills..." />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={onRetry} />;
  return <Loaded data={state.data} onRunScoring={onRunScoring} scoring={scoring} />;
}
