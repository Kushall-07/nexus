import { ApiError } from "../../api/client";
import type { GapAnalysisResponse, GapExplanationResponse } from "../../api/types";
import { describeError } from "../../components/StateViews";

export type ExplanationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "done"; result: GapExplanationResponse };

interface Props {
  analysis: GapAnalysisResponse;
  state: ExplanationState;
  onExplain: () => void;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function ExplanationFailure({ error }: { error: ApiError }) {
  const message =
    error.code === "LLM_NOT_CONFIGURED"
      ? "AI explanations are optional and have not been configured on this server."
      : describeError(error);

  return (
    <p role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
      {message} Your Evidence Scores and gap analysis above are unaffected.
    </p>
  );
}

function ExplanationBody({ analysis, result }: { analysis: GapAnalysisResponse; result: GapExplanationResponse }) {
  const { explanation } = result;
  // Names come from the deterministic result; the model only supplies a skill id.
  const names = new Map(analysis.requirements.map((entry) => [entry.skillId, entry.skillName]));

  return (
    <div className="space-y-4 text-sm text-slate-800">
      <p className="text-xs font-medium text-slate-600">AI-generated explanation. It may contain mistakes; the scores above are authoritative.</p>
      <section aria-labelledby="ai-summary">
        <h4 id="ai-summary" className="font-semibold text-slate-900">Overall summary</h4>
        <p className="mt-1">{explanation.summary}</p>
      </section>
      {explanation.strengths.length > 0 ? (
        <section aria-labelledby="ai-strengths">
          <h4 id="ai-strengths" className="font-semibold text-slate-900">Observed strengths</h4>
          <List items={explanation.strengths} />
        </section>
      ) : null}
      {explanation.priorityGaps.length > 0 ? (
        <section aria-labelledby="ai-gaps">
          <h4 id="ai-gaps" className="font-semibold text-slate-900">Priority gaps</h4>
          <ul className="list-disc space-y-1 pl-5">
            {explanation.priorityGaps.map((gap) => (
              <li key={gap.skillId}>
                <span className="font-medium">{names.get(gap.skillId) ?? gap.skillId}:</span> {gap.explanation}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="ai-actions">
        <h4 id="ai-actions" className="font-semibold text-slate-900">Recommended next actions</h4>
        <List items={explanation.recommendedActions} />
      </section>
      <section aria-labelledby="ai-limits">
        <h4 id="ai-limits" className="font-semibold text-slate-900">Limitations</h4>
        <List items={explanation.limitations} />
      </section>
    </div>
  );
}

export function ExplanationPanel({ analysis, state, onExplain }: Props) {
  const loading = state.status === "loading";
  const label = loading ? "Generating..." : state.status === "done" ? "Regenerate explanation" : state.status === "error" ? "Try again" : "Generate explanation";

  return (
    <section aria-labelledby="ai-explanation-heading" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 id="ai-explanation-heading" className="text-lg font-semibold text-slate-900">AI Explanation</h3>
      <p className="max-w-3xl text-sm text-slate-600">
        Understand your existing evidence scores and the most important gaps. Numerical scores and role thresholds are
        computed by NEXUS&apos;s deterministic scoring engine.
      </p>
      <button
        type="button"
        onClick={onExplain}
        disabled={loading}
        className="rounded-md bg-indigo-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
      >
        {label}
      </button>
      {loading ? <p role="status" className="text-sm text-slate-700">Generating explanation...</p> : null}
      {state.status === "error" ? <ExplanationFailure error={state.error} /> : null}
      {state.status === "done" ? <ExplanationBody analysis={analysis} result={state.result} /> : null}
    </section>
  );
}
