import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiGet, apiPut } from "../../api/client";
import type { CareerProfileResponse, TaskStatus, TransitionAnalysis, TransitionGap } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { RefreshPanel } from "./RefreshPanel";
import { buttonClass, inputClass, primaryButtonClass } from "./jobParts";

const STATUS_TEXT: Record<TransitionGap["status"], string> = {
  demonstrated: "Demonstrated by GitHub evidence",
  partial: "Partly demonstrated (below the benchmark)",
  "resume-claimed": "Claimed in resume, not yet verified by GitHub evidence",
  missing: "Missing — no supporting evidence found",
  unverified: "Unverified — no GitHub analysis yet",
};

const TASK_LABELS: Record<TaskStatus, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed", skipped: "Skipped" };

export function ProgressSummary({ analysis }: { analysis: TransitionAnalysis }) {
  const counts = { planned: 0, in_progress: 0, completed: 0, skipped: 0 } as Record<TaskStatus, number>;
  for (const gap of analysis.gaps) if (gap.taskStatus) counts[gap.taskStatus] += 1;
  const untouched = analysis.gaps.filter((gap) => !gap.taskStatus).length;
  const total = analysis.gaps.length;
  const completedPct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  return (
    <div className="space-y-3" aria-label="Learning progress">
      {/* Visual progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          <span>{counts.completed} of {total} gaps addressed</span>
          <span className="tabular-nums font-medium">{completedPct}%</span>
        </div>
        <div
          role="meter"
          aria-label="Skill gap progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completedPct}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Task counts">
        {([["Open gaps", total], ["Not started", untouched], ["Planned", counts.planned], ["In progress", counts.in_progress], ["Completed", counts.completed]] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STATUS_COLOR: Record<TransitionGap["status"], string> = {
  demonstrated: "bg-emerald-100 text-emerald-800 border-emerald-200",
  partial: "bg-amber-100 text-amber-800 border-amber-200",
  "resume-claimed": "bg-sky-100 text-sky-800 border-sky-200",
  missing: "bg-red-100 text-red-800 border-red-200",
  unverified: "bg-slate-100 text-slate-700 border-slate-200",
};

export function GapList({ analysis, onTask, busySkill }: { analysis: TransitionAnalysis; onTask?: (skillId: string, status: TaskStatus) => void; busySkill?: string | null }) {
  if (analysis.gaps.length === 0) {
    return <EmptyState title="No open gaps">Your current evidence meets the benchmark for {analysis.direction.displayName}.</EmptyState>;
  }
  return (
    <ol className="space-y-3" aria-label="Prioritized skill gaps">
      {analysis.gaps.map((gap, index) => (
        <li key={gap.skillId} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900">
              {index + 1}. {gap.skillName}
            </h3>
            <span className="text-xs text-slate-500">priority {gap.priority.toFixed(2)}</span>
          </div>
          <p className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[gap.status]}`}>
            {STATUS_TEXT[gap.status]}{gap.githubScore !== null ? ` (Evidence Score ${gap.githubScore.toFixed(1)})` : ""}
          </p>
          <p className="mt-1.5 text-sm text-slate-700">{gap.whyItMatters}</p>
          {gap.prerequisites.length > 0 ? (
            <p className="mt-1 text-xs text-slate-600">Prerequisites not yet demonstrated: {gap.prerequisites.map((pre) => pre.skillName).join(", ")}</p>
          ) : null}
          <dl className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
            <div><dt className="inline font-medium text-slate-700">Learn: </dt><dd className="inline text-slate-700">{gap.task.learn}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Build: </dt><dd className="inline text-slate-700">{gap.task.milestone}</dd></div>
            <div><dt className="inline font-medium text-slate-700">Verify: </dt><dd className="inline text-slate-700">{gap.task.verification}</dd></div>
            {gap.task.effortHours ? (
              <div><dt className="inline font-medium text-slate-700">Rough effort: </dt><dd className="inline text-slate-700">{gap.task.effortHours[0]}–{gap.task.effortHours[1]} hours</dd></div>
            ) : null}
          </dl>
          {onTask ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor={`task-${gap.skillId}`} className="shrink-0 text-sm font-medium text-slate-700">Task status for {gap.skillName}</label>
              <select
                id={`task-${gap.skillId}`}
                className={`${inputClass} max-w-xs`}
                value={gap.taskStatus ?? ""}
                disabled={busySkill === gap.skillId}
                onChange={(event) => event.target.value && onTask(gap.skillId, event.target.value as TaskStatus)}
              >
                <option value="">Not started</option>
                {(Object.keys(TASK_LABELS) as TaskStatus[]).map((status) => (
                  <option key={status} value={status}>{TASK_LABELS[status]}</option>
                ))}
              </select>
              {gap.taskStatus === "completed" ? (
                <p className="w-full text-xs text-slate-500">Marking complete does not verify the skill — push to GitHub and refresh.</p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function DevelopmentPage() {
  const profile = useApiResource(() => apiGet<CareerProfileResponse>("/api/career/profile"), []);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "demo">("live");
  const [version, setVersion] = useState(0);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const direction = preview ?? (profile.state.status === "success" ? (profile.state.data.learning.direction ?? profile.state.data.preferences.directions[0] ?? null) : null);
  const plan = useApiResource(
    () => (direction ? apiGet<TransitionAnalysis>(`/api/career/transition?direction=${encodeURIComponent(direction)}&source=${source}`) : Promise.resolve(null)),
    [direction, source, version, profile.state.status],
  );

  if (profile.state.status === "loading") return <LoadingState label="Loading your plan..." />;
  if (profile.state.status === "error") return <ErrorState error={profile.state.error} onRetry={profile.reload} />;
  const data = profile.state.data;
  const saved = data.learning.direction;

  async function setDirection(directionId: string | null) {
    setError(null);
    try {
      await apiPut("/api/career/direction", { directionId });
      setPreview(null);
      profile.reload();
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    }
  }

  async function setTask(skillId: string, status: TaskStatus) {
    setBusySkill(skillId);
    setError(null);
    try {
      await apiPut(`/api/career/tasks/${skillId}`, { status });
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    } finally {
      setBusySkill(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Skill development</h1>
        <p className="text-sm text-slate-600">
          Pick a career direction to see which skills your evidence does not yet demonstrate, in priority order. A direction is a preference you can change or clear at any time; it never limits your job search.
        </p>
      </div>

      <RefreshPanel evidence={data.evidence} refresh={data.refresh} onDone={() => { profile.reload(); setVersion((value) => value + 1); }} />

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="direction" className="block text-sm font-medium text-slate-900">Career direction</label>
        <div className="flex flex-wrap items-center gap-2">
          <select id="direction" className={`${inputClass} max-w-xs`} value={direction ?? ""} onChange={(event) => setPreview(event.target.value || null)}>
            <option value="">Choose a direction…</option>
            {data.directions.map((option) => (
              <option key={option.id} value={option.id}>{option.displayName}</option>
            ))}
          </select>
          <button type="button" className={primaryButtonClass} disabled={!direction || direction === saved} onClick={() => direction && setDirection(direction)}>
            Set as my direction
          </button>
          {saved ? <button type="button" className={buttonClass} onClick={() => setDirection(null)}>Clear direction</button> : null}
        </div>
        {preview && preview !== saved ? <p className="text-xs text-slate-600">Previewing only — your saved direction is unchanged.</p> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={source === "demo"} onChange={(event) => setSource(event.target.checked ? "demo" : "live")} />
          Use demo listings as the employer-demand sample (fixtures, not live market data)
        </label>
      </div>

      {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{describeError(error)}</p> : null}

      {!direction ? (
        <EmptyState title="Choose a direction to see your plan">
          You can also just browse <Link to="/opportunities" className="underline">opportunities</Link> without choosing one.
        </EmptyState>
      ) : plan.state.status === "loading" ? (
        <LoadingState label="Building your skill plan..." />
      ) : plan.state.status === "error" ? (
        <ErrorState error={plan.state.error} onRetry={plan.reload} />
      ) : plan.state.data ? (
        <div className="space-y-3">
          <section aria-label="Next action" className="rounded-lg border border-indigo-300 bg-indigo-50 p-4">
            <h2 className="font-semibold text-indigo-950">Next recommended action</h2>
            <p className="text-sm text-indigo-950">{plan.state.data.nextAction}</p>
          </section>
          <p className="text-sm text-slate-700">
            Baseline: role benchmark v{plan.state.data.baseline.version} · Employer demand: {plan.state.data.demand.source === "none" ? "no listings sampled" : `${plan.state.data.demand.sampleSize} ${plan.state.data.demand.source === "demo" ? "demo fixture" : "live"} listings`}. {plan.state.data.demand.note}
          </p>
          <ProgressSummary analysis={plan.state.data} />
          <GapList analysis={plan.state.data} onTask={setTask} busySkill={busySkill} />
          {plan.state.data.alreadyDemonstrated.length > 0 ? (
            <p className="text-sm text-slate-700">Already demonstrated: {plan.state.data.alreadyDemonstrated.map((skill) => skill.skillName).join(", ")}.</p>
          ) : null}
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            {plan.state.data.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
