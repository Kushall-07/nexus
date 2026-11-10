import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain, Check, Cloud, Code2, Cpu, Database, LayoutTemplate, Layers, Server, Target, type LucideIcon,
} from "lucide-react";
import { ApiError, apiGet, apiPut } from "../../api/client";
import type { CareerProfileResponse, TaskStatus, TransitionAnalysis, TransitionGap } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { RefreshPanel } from "./RefreshPanel";
import { inputClass } from "./jobParts";
import { PlanRoadmap } from "./RoadmapPlan";

const STATUS_TEXT: Record<TransitionGap["status"], string> = {
  demonstrated: "Demonstrated by GitHub evidence",
  partial: "Partly demonstrated (below the benchmark)",
  "resume-claimed": "Claimed in resume, not yet verified by GitHub evidence",
  missing: "Missing — no supporting evidence found",
  unverified: "Unverified — no GitHub analysis yet",
};

const TASK_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
};

export function ProgressSummary({ analysis }: { analysis: TransitionAnalysis }) {
  const counts = { not_started: 0, planned: 0, in_progress: 0, completed: 0, skipped: 0 } as Record<TaskStatus, number>;
  for (const gap of analysis.gaps) counts[gap.taskStatus ?? "not_started"] += 1;
  const untouched = counts.not_started;
  const total = analysis.gaps.length;
  const completedPct = total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  return (
    <div className="space-y-3" aria-label="Learning progress">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>{counts.completed} of {total} gaps addressed</span>
          <span className="tabular-nums font-semibold text-slate-700">{completedPct}%</span>
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
            className="h-full rounded-full nx-score-fill transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Task counts">
        {([["Open gaps", total], ["Not started", untouched], ["Planned", counts.planned], ["In progress", counts.in_progress], ["Completed", counts.completed]] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
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

const GAP_ACCENT: Record<TransitionGap["status"], string> = {
  demonstrated: "nx-panel-success",
  partial: "nx-panel-warning",
  "resume-claimed": "nx-panel",
  missing: "nx-panel-danger",
  unverified: "",
};

export function GapList({
  analysis,
  onTask,
  busySkill,
  layout = "stack",
}: {
  analysis: TransitionAnalysis;
  onTask?: (skillId: string, status: TaskStatus) => void;
  busySkill?: string | null;
  /** "grid" lays the gaps out as equal-height columns (used on the Overview). */
  layout?: "stack" | "grid";
}) {
  if (analysis.gaps.length === 0) {
    return <EmptyState title="No open gaps">Your current evidence meets the benchmark for {analysis.direction.displayName}.</EmptyState>;
  }
  // Columns follow the item count so a row is always filled edge to edge.
  const gridCols = analysis.gaps.length >= 3 ? "xl:grid-cols-3" : analysis.gaps.length === 2 ? "md:grid-cols-2" : "";
  return (
    <ol className={layout === "grid" ? `grid grid-cols-1 items-stretch gap-3 ${gridCols}` : "space-y-3"} aria-label="Prioritized skill gaps">
      {analysis.gaps.map((gap, index) => (
        <li key={gap.skillId} className={`nx-card rounded-2xl border border-slate-200 bg-white p-5 ${layout === "grid" ? "h-full" : ""} ${GAP_ACCENT[gap.status]}`}>
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-slate-900 text-base" aria-label={`${index + 1}. ${gap.skillName}`}>
              <span className="font-mono text-sm text-slate-400 mr-2 tabular-nums" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {gap.skillName}
            </h3>
            <span className="text-xs text-slate-400 tabular-nums font-mono">p {gap.priority.toFixed(2)}</span>
          </div>
          <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[gap.status]}`}>
            {STATUS_TEXT[gap.status]}{gap.githubScore !== null ? ` · Score ${gap.githubScore.toFixed(1)}` : ""}
          </span>
          <p className="mt-2.5 text-sm text-slate-700 leading-relaxed">{gap.whyItMatters}</p>
          {gap.prerequisites.length > 0 ? (
            <p className="mt-1.5 text-xs text-slate-500 italic">
              Prerequisites not yet demonstrated: {gap.prerequisites.map((pre) => pre.skillName).join(", ")}
            </p>
          ) : null}
          <dl className="mt-3.5 space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
            <div><dt className="inline font-semibold text-slate-700">Learn: </dt><dd className="inline text-slate-600">{gap.task.learn}</dd></div>
            <div><dt className="inline font-semibold text-slate-700">Build: </dt><dd className="inline text-slate-600">{gap.task.milestone}</dd></div>
            <div><dt className="inline font-semibold text-slate-700">Verify: </dt><dd className="inline text-slate-600">{gap.task.verification}</dd></div>
            {gap.task.effortHours ? (
              <div><dt className="inline font-semibold text-slate-700">Rough effort: </dt><dd className="inline text-slate-600 tabular-nums">{gap.task.effortHours[0]}–{gap.task.effortHours[1]} hours</dd></div>
            ) : null}
          </dl>
          {onTask ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <label htmlFor={`task-${gap.skillId}`} className="shrink-0 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Task status for {gap.skillName}
              </label>
              <select
                id={`task-${gap.skillId}`}
                className={`${inputClass} max-w-[180px]`}
                value={gap.taskStatus ?? "not_started"}
                disabled={busySkill === gap.skillId}
                onChange={(event) => onTask(gap.skillId, event.target.value as TaskStatus)}
              >
                {(Object.keys(TASK_LABELS) as TaskStatus[]).map((status) => (
                  <option key={status} value={status}>{TASK_LABELS[status]}</option>
                ))}
              </select>
              {gap.taskStatus === "completed" ? (
                <p className="w-full text-xs text-slate-500">
                  Marking complete does not verify the skill — push to GitHub and refresh.
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** A fitting icon for a role, from its id. */
function roleIcon(id: string): LucideIcon {
  const key = id.toLowerCase();
  if (key.includes("full")) return Layers;
  if (key.includes("backend")) return Server;
  if (key.includes("frontend")) return LayoutTemplate;
  if (key.includes("ml") || key.includes("machine")) return Cpu;
  if (key.includes("ai")) return Brain;
  if (key.includes("data")) return Database;
  if (key.includes("devops") || key.includes("cloud")) return Cloud;
  if (key.includes("software")) return Code2;
  return Target;
}

/** Desktop column count per number of roles, so a row is always filled edge to edge. */
const CARD_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-3",
};

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
  const showCards = data.directions.length > 0 && data.directions.length <= 10;

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
    <div className="space-y-6 nx-stagger">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
          Role & Gap Analysis
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl" style={{ lineHeight: 1.65 }}>
          Pick a career direction to see which skills your evidence does not yet demonstrate, in priority order.
          A direction is a preference you can change or clear at any time — it never limits your job search.
        </p>
      </div>

      {/* Direction picker */}
      <div className="nx-card space-y-5 rounded-2xl border border-slate-200 bg-white px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <label htmlFor="direction" className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Career direction
          </label>
          <span className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${saved ? "bg-[oklch(62%_0.17_36)]" : "bg-slate-300"}`} />
            {saved ? (
              <>Saved: <b className="font-semibold text-slate-800">{data.directions.find((o) => o.id === saved)?.displayName ?? saved}</b></>
            ) : (
              "No direction saved yet"
            )}
          </span>
        </div>

        {/* The select stays the accessible control; with few roles it is replaced visually by equal cards. */}
        <select
          id="direction"
          className={showCards ? "sr-only" : `${inputClass} max-w-sm`}
          value={direction ?? ""}
          onChange={(event) => setPreview(event.target.value || null)}
        >
          <option value="">Choose a direction…</option>
          {data.directions.map((option) => (
            <option key={option.id} value={option.id}>{option.displayName}</option>
          ))}
        </select>

        {showCards ? (
          <div
            role="group"
            aria-label="Quick pick a direction"
            className={`grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 [&>*:last-child:nth-child(odd)]:min-[460px]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1 ${CARD_COLUMNS[Math.min(data.directions.length, 6)] ?? "lg:grid-cols-4"}`}
          >
            {data.directions.map((option) => {
              const active = option.id === direction;
              const isSaved = option.id === saved;
              const Icon = roleIcon(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPreview(option.id === saved ? null : option.id)}
                  className={[
                    "group relative flex h-[4.75rem] items-center gap-2.5 overflow-hidden rounded-2xl border px-3.5 text-left",
                    "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2",
                    active
                      ? "border-indigo-700 shadow-[0_14px_26px_-16px_rgba(14,79,74,0.9)]"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-[0_12px_22px_-16px_rgba(14,79,74,0.6)]",
                  ].join(" ")}
                >
                  {active && (
                    <motion.span
                      layoutId="direction-pill"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-800"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                      active ? "bg-white/15 text-[var(--color-indigo-950)]" : "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="relative z-10 min-w-0 flex-1">
                    <span className={`block line-clamp-2 break-words text-sm font-semibold leading-tight ${active ? "text-[var(--color-indigo-950)]" : "text-slate-900"}`}>
                      {option.displayName}
                    </span>
                    <span className={`block text-[11px] ${active ? "text-indigo-100/85" : "text-slate-500"}`}>
                      {isSaved ? "Your direction" : active ? "Previewing" : "View plan"}
                    </span>
                  </span>
                  {isSaved ? (
                    <span className="relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[oklch(62%_0.17_36)] text-white" title="Your saved direction">
                      <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {preview && preview !== saved ? (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700"
          >
            Previewing only — your saved direction is unchanged.
          </motion.p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-slate-100 pt-4">
          <label className="group flex cursor-pointer items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={source === "demo"}
              onChange={(event) => setSource(event.target.checked ? "demo" : "live")}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-indigo-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-700 peer-focus-visible:ring-offset-2"
            />
            Use demo listings as the employer-demand sample
          </label>

          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <button
              type="button"
              className="nx-btn nx-btn-primary min-w-[12.5rem] flex-1 sm:flex-none"
              disabled={!direction || direction === saved}
              onClick={() => direction && setDirection(direction)}
            >
              <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
              Set as my direction
            </button>
            {saved ? (
              <button type="button" className="nx-btn nx-btn-ghost min-w-[12.5rem] flex-1 sm:flex-none" onClick={() => setDirection(null)}>
                Clear direction
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="nx-card rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          {describeError(error)}
        </div>
      ) : null}

      {!direction ? (
        <EmptyState title="Choose a direction to see your plan">
          You can also just browse{" "}
          <Link to="/opportunities" className="underline text-indigo-700">opportunities</Link>{" "}
          without choosing one.
        </EmptyState>
      ) : plan.state.status === "loading" ? (
        <LoadingState label="Building your skill plan…" />
      ) : plan.state.status === "error" ? (
        <ErrorState error={plan.state.error} onRetry={plan.reload} />
      ) : plan.state.data ? (
        <PlanRoadmap analysis={plan.state.data} onTask={setTask} busySkill={busySkill} />
      ) : null}

      {/* GitHub evidence + refresh */}
      <RefreshPanel
        evidence={data.evidence}
        refresh={data.refresh}
        onDone={() => { profile.reload(); setVersion((value) => value + 1); }}
      />
    </div>
  );
}
