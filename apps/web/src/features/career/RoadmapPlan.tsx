/**
 * The plan as a roadmap: readiness hero, summary tiles, a status strip, then one step per
 * skill gap in priority order — each with your score against the benchmark, Learn / Build /
 * Verify, and one-click progress. Used by the Role & Gap Analysis page.
 */
import { motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Clock } from "lucide-react";
import type { TaskStatus, TransitionAnalysis, TransitionGap } from "../../api/career-types";
import { EmptyState } from "../../components/StateViews";
import { inputClass } from "./jobParts";
import { CountUp, HeroGlow, Ring, heroShell } from "./spotlight";

// ── Labels ─────────────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<TransitionGap["status"], string> = {
  demonstrated: "Demonstrated by GitHub evidence",
  partial: "Partly demonstrated (below the benchmark)",
  "resume-claimed": "Claimed in resume, not yet verified by GitHub evidence",
  missing: "Missing — no supporting evidence found",
  unverified: "Unverified — no GitHub analysis yet",
};

const STATUS_SHORT: Record<TransitionGap["status"], string> = {
  demonstrated: "Demonstrated",
  partial: "Partly shown",
  "resume-claimed": "Claimed in resume",
  missing: "Missing",
  unverified: "Unverified",
};

// Light, theme-matched tints (the global red/amber/emerald scales are inverted for dark UI).
const STATUS_STYLE: Record<TransitionGap["status"], { background: string; color: string }> = {
  demonstrated: { background: "oklch(94% 0.025 165)", color: "oklch(30% 0.065 192)" },
  partial: { background: "oklch(94% 0.05 85)", color: "oklch(42% 0.1 70)" },
  "resume-claimed": { background: "oklch(93% 0.03 240)", color: "oklch(40% 0.11 245)" },
  missing: { background: "oklch(93% 0.035 26)", color: "oklch(44% 0.16 26)" },
  unverified: { background: "oklch(92% 0.01 200)", color: "oklch(40% 0.02 200)" },
};

const TASK_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
};

const TASK_ORDER: TaskStatus[] = ["not_started", "planned", "in_progress", "completed", "skipped"];

const TASK_COLOR: Record<TaskStatus, string> = {
  not_started: "oklch(82% 0.015 72)",
  planned: "oklch(60% 0.075 185)",
  in_progress: "oklch(62% 0.17 36)",
  completed: "oklch(30% 0.065 192)",
  skipped: "oklch(90% 0.013 72)",
};

/** The one-click "next step" for each task status. */
const ADVANCE: Record<TaskStatus, { to: TaskStatus; label: string } | null> = {
  not_started: { to: "planned", label: "Plan it" },
  planned: { to: "in_progress", label: "Start" },
  in_progress: { to: "completed", label: "Mark complete" },
  completed: null,
  skipped: { to: "not_started", label: "Restore" },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

/** Columns follow the item count so the row is always filled edge to edge. */
function DEMONSTRATED_COLUMNS(count: number): string {
  if (count >= 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "sm:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "";
}

function demandLabel(demand: TransitionAnalysis["demand"]): string {
  if (demand.source === "none") return "no listings sampled";
  return `${demand.sampleSize} ${demand.source === "demo" ? "demo fixture" : "live"} listings`;
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

function Tile({ label, value, detail, children }: { label: string; value: React.ReactNode; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="nx-card rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="font-display mt-1 text-[1.9rem] leading-none tabular-nums text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
      {children}
    </div>
  );
}

/** Your score against the benchmark: a fill for you, a coral tick for the target. */
function VersusBar({ gap, sampleSize }: { gap: TransitionGap; sampleSize: number }) {
  if (gap.minimumScore === null) return null;
  const mine = gap.githubScore ?? 0;
  return (
    <div>
      <div
        role="img"
        aria-label={`Your score ${gap.githubScore === null ? "none" : gap.githubScore.toFixed(0)}, benchmark ${gap.minimumScore}`}
        className="relative h-2.5 rounded-full bg-slate-200"
      >
        <motion.i
          className="nx-score-fill absolute inset-y-0 left-0 block rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.max(mine, 0), 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <b
          className="absolute -inset-y-1 w-[3px] rounded-full bg-[oklch(62%_0.17_36)]"
          style={{ left: `${Math.min(Math.max(gap.minimumScore, 0), 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-slate-500">
        <span>You: <b className="font-semibold text-slate-700">{gap.githubScore === null ? "no evidence" : gap.githubScore.toFixed(0)}</b></span>
        <span>Benchmark: <b className="font-semibold text-slate-700">{gap.minimumScore}</b></span>
        {sampleSize > 0 ? (
          <span>In <b className="font-semibold tabular-nums text-slate-700">{gap.demandCount}</b> of {sampleSize} listings</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Step ───────────────────────────────────────────────────────────────────────

function Step({
  gap,
  index,
  last,
  state,
  sampleSize,
  onTask,
  busy,
}: {
  gap: TransitionGap;
  index: number;
  last: boolean;
  state: "done" | "now" | "todo" | "skipped";
  sampleSize: number;
  onTask?: (skillId: string, status: TaskStatus) => void;
  busy: boolean;
}) {
  const status = gap.taskStatus ?? "not_started";
  const advance = ADVANCE[status];
  const style = STATUS_STYLE[gap.status];

  return (
    <motion.li variants={fadeUp} id={`gap-${gap.skillId}`} className="relative scroll-mt-24">
      {/* Timeline: the line runs in the gap between cards and the node sits on the card's left edge,
          so every card in the page shares the same left and right edges. */}
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-6 left-[-1.5px] top-12 w-[3px] rounded-full ${state === "done" ? "bg-indigo-700" : "bg-slate-300"}`}
        />
      )}
      <motion.span
        key={state}
        aria-hidden="true"
        initial={{ scale: 0.5, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className={[
          "absolute -left-4 top-5 z-10 grid h-8 w-8 place-items-center rounded-full border-[3px] border-[var(--color-slate-50)] text-xs font-bold",
          state === "done" && "bg-indigo-700 text-[var(--color-indigo-950)]",
          state === "now" && "bg-[oklch(62%_0.17_36)] text-white shadow-[0_0_0_6px_oklch(70%_0.148_36_/_0.22)]",
          state === "todo" && "bg-white text-slate-500 ring-1 ring-slate-300",
          state === "skipped" && "bg-slate-200 text-slate-400",
        ].filter(Boolean).join(" ")}
      >
        {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
      </motion.span>

      <div className={`nx-card relative z-[1] space-y-4 rounded-2xl border bg-white p-5 pl-7 transition-shadow duration-200 hover:shadow-[0_16px_30px_-22px_rgba(14,79,74,0.55)] ${state === "now" ? "border-indigo-300" : "border-slate-200"} ${state === "skipped" ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900" aria-label={`${index + 1}. ${gap.skillName}`}>
              {gap.skillName}
            </h3>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={style}>{STATUS_SHORT[gap.status]}</span>
            <span
              title={`Priority score ${gap.priority.toFixed(2)}`}
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${index === 0 ? "bg-[oklch(62%_0.17_36)] text-white" : "bg-slate-800 text-white"}`}
            >
              Priority {index + 1}
            </span>
          </div>
          {gap.task.effortHours ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {gap.task.effortHours[0]}–{gap.task.effortHours[1]} h
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm leading-relaxed text-slate-700">{gap.whyItMatters}</p>
          <p className="text-xs text-slate-500">
            {STATUS_TEXT[gap.status]}
            {gap.githubScore !== null ? ` · Score ${gap.githubScore.toFixed(1)}` : ""}
          </p>
          {gap.prerequisites.length > 0 ? (
            <p className="text-xs italic text-slate-500">
              Prerequisites not yet demonstrated: {gap.prerequisites.map((pre) => pre.skillName).join(", ")}
            </p>
          ) : null}
        </div>

        <VersusBar gap={gap} sampleSize={sampleSize} />

        <details open={state === "now"} className="group rounded-xl border border-slate-100 bg-slate-50/80">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 [&::-webkit-details-marker]:hidden">
            Learn · Build · Verify
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <dl className="grid gap-2.5 px-4 pb-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3"><dt className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-indigo-700">Learn</dt><dd className="text-slate-600">{gap.task.learn}</dd></div>
            <div className="rounded-lg bg-white p-3"><dt className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-indigo-700">Build</dt><dd className="text-slate-600">{gap.task.milestone}</dd></div>
            <div className="rounded-lg bg-white p-3"><dt className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-indigo-700">Verify</dt><dd className="text-slate-600">{gap.task.verification}</dd></div>
            {gap.task.effortHours ? (
              <div className="text-xs text-slate-500 sm:col-span-3">
                <span className="font-semibold text-slate-700">Rough effort:</span>{" "}
                <span className="tabular-nums">{gap.task.effortHours[0]}–{gap.task.effortHours[1]} hours</span>
              </div>
            ) : null}
          </dl>
        </details>

        {onTask ? (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4">
            <label htmlFor={`task-${gap.skillId}`} className="sr-only">Task status for {gap.skillName}</label>
            <span aria-hidden="true" className="text-xs font-bold uppercase tracking-wider text-slate-500">Progress</span>
            <select
              id={`task-${gap.skillId}`}
              className={`${inputClass} !w-auto !py-1.5`}
              value={status}
              disabled={busy}
              onChange={(event) => onTask(gap.skillId, event.target.value as TaskStatus)}
            >
              {TASK_ORDER.map((value) => (
                <option key={value} value={value}>{TASK_LABELS[value]}</option>
              ))}
            </select>
            {advance ? (
              <button
                type="button"
                disabled={busy}
                aria-label={`${advance.label}: ${gap.skillName}`}
                onClick={() => onTask(gap.skillId, advance.to)}
                className={`nx-btn nx-btn-sm ${
                  status === "in_progress" ? "nx-btn-coral" : status === "skipped" ? "nx-btn-ghost" : "nx-btn-primary"
                }`}
              >
                {advance.label}
                <ArrowRight className="nx-arrow h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
            {status === "completed" ? (
              <p className="w-full text-xs text-slate-500">
                Marking complete does not verify the skill — push to GitHub and refresh.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.li>
  );
}

// ── The plan ───────────────────────────────────────────────────────────────────

export function PlanRoadmap({
  analysis,
  onTask,
  busySkill,
}: {
  analysis: TransitionAnalysis;
  onTask: (skillId: string, status: TaskStatus) => void;
  busySkill: string | null;
}) {
  const { gaps, alreadyDemonstrated, demand } = analysis;

  const counts: Record<TaskStatus, number> = { not_started: 0, planned: 0, in_progress: 0, completed: 0, skipped: 0 };
  for (const gap of gaps) counts[gap.taskStatus ?? "not_started"] += 1;

  const demonstrated = alreadyDemonstrated.length;
  const benchmarkSkills = demonstrated + gaps.length;
  const readiness = benchmarkSkills > 0 ? demonstrated / benchmarkSkills : 0;

  let hoursMin = 0;
  let hoursMax = 0;
  for (const gap of gaps) {
    const status = gap.taskStatus ?? "not_started";
    if (status === "completed" || status === "skipped" || !gap.task.effortHours) continue;
    hoursMin += gap.task.effortHours[0];
    hoursMax += gap.task.effortHours[1];
  }

  // The current step is the first one that is neither completed nor skipped.
  const currentIndex = gaps.findIndex((g) => (g.taskStatus ?? "not_started") !== "completed" && g.taskStatus !== "skipped");
  const stateOf = (gap: TransitionGap, i: number): "done" | "now" | "todo" | "skipped" =>
    gap.taskStatus === "completed" ? "done" : gap.taskStatus === "skipped" ? "skipped" : i === currentIndex ? "now" : "todo";

  const addressedPct = gaps.length > 0 ? Math.round((counts.completed / gaps.length) * 100) : 0;

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }} className="space-y-6">
      {/* Hero */}
      <motion.section variants={fadeUp} aria-label="Plan overview" className={`${heroShell} grid gap-6 p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-8`}>
        <HeroGlow />
        <div className="relative">
          <Ring progress={readiness} size={124}>
            <span className="text-center">
              <span className="font-display block text-[2.4rem] leading-none tabular-nums text-[var(--color-indigo-950)]">
                {demonstrated}<span className="text-[1.5rem] text-indigo-200">/{benchmarkSkills}</span>
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-indigo-200">demonstrated</span>
            </span>
          </Ring>
        </div>
        <div className="relative min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">Next recommended action</h2>
          <p className="font-display mt-1.5 text-[1.9rem] leading-[1.02] tracking-tight text-[var(--color-indigo-950)]">{analysis.nextAction}</p>
          <p className="mt-2 text-sm text-indigo-100/80">
            {analysis.direction.displayName} · {Math.round(readiness * 100)}% of the benchmark skills are demonstrated.
          </p>
          {currentIndex >= 0 ? (
            <a
              href={`#gap-${gaps[currentIndex]!.skillId}`}
              className="nx-btn nx-btn-coral mt-4 px-6 py-3"
            >
              Go to your current step
              <ArrowRight className="nx-arrow h-4 w-4" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </motion.section>

      {/* Summary tiles */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        <Tile label="Open gaps" value={<CountUp value={gaps.length} />} detail={`to close for ${analysis.direction.displayName}`} />
        <Tile
          label="Effort left"
          value={hoursMax > 0 ? <><CountUp value={hoursMin} />–<CountUp value={hoursMax} /> h</> : "—"}
          detail="across unfinished gaps"
        />
        <Tile label="Addressed" value={<><CountUp value={counts.completed} /> / {gaps.length}</>} detail="gaps completed">
          <div
            role="progressbar"
            aria-label="Skill gap progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={addressedPct}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
          >
            <div className="nx-score-fill h-full rounded-full transition-all duration-500" style={{ width: `${addressedPct}%` }} />
          </div>
        </Tile>
        <Tile label="Employer demand" value={demand.source === "none" ? "—" : <CountUp value={demand.sampleSize} />} detail={demand.source === "none" ? "no listings sampled" : `${demand.source === "demo" ? "demo" : "live"} listings sampled`} />
      </motion.div>

      {gaps.length === 0 ? (
        <EmptyState title="No open gaps">Your current evidence meets the benchmark for {analysis.direction.displayName}.</EmptyState>
      ) : (
        <>
          {/* Status strip (board-style summary) */}
          <motion.div variants={fadeUp} className="nx-card rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Your progress</h2>
              <span className="text-xs text-slate-500">Move a step forward with one click</span>
            </div>
            <div role="img" aria-label="Task status summary" className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
              {TASK_ORDER.map((key) =>
                counts[key] > 0 ? (
                  <motion.span
                    key={key}
                    className="block h-full"
                    style={{ backgroundColor: TASK_COLOR[key] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(counts[key] / gaps.length) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {TASK_ORDER.map((key) => (
                <li key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_COLOR[key] }} />
                  {TASK_LABELS[key]}
                  <span className="font-semibold tabular-nums text-slate-800">{counts[key]}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Roadmap */}
          <ol aria-label="Prioritized skill gaps" className="space-y-5">
            {gaps.map((gap, index) => (
              <Step
                key={gap.skillId}
                gap={gap}
                index={index}
                last={index === gaps.length - 1}
                state={stateOf(gap, index)}
                sampleSize={demand.source === "none" ? 0 : demand.sampleSize}
                onTask={onTask}
                busy={busySkill === gap.skillId}
              />
            ))}
          </ol>
        </>
      )}

      {/* Already demonstrated */}
      {alreadyDemonstrated.length > 0 ? (
        <motion.section variants={fadeUp} aria-label="Already demonstrated" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-indigo-700 text-[var(--color-indigo-950)]">
                <Check className="h-3 w-3" strokeWidth={3.5} />
              </span>
              <span>Already demonstrated</span>
            </h2>
            <p className="text-xs text-slate-500">
              {alreadyDemonstrated.length} {alreadyDemonstrated.length === 1 ? "skill meets" : "skills meet"} the benchmark
            </p>
          </div>
          <ul className={`grid grid-cols-1 items-stretch gap-3 ${DEMONSTRATED_COLUMNS(alreadyDemonstrated.length)}`}>
            {alreadyDemonstrated.map((skill, i) => (
              <motion.li
                key={skill.skillId}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className="nx-card flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-[0_16px_30px_-22px_rgba(14,79,74,0.55)]"
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Check className="h-5 w-5" strokeWidth={2.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{skill.skillName}</p>
                    <p className="text-xs text-slate-500">Meets the benchmark</p>
                  </div>
                  <p className="font-display text-[1.7rem] leading-none tabular-nums text-indigo-700">
                    <CountUp value={Math.round(skill.githubScore)} />
                  </p>
                </div>
                <div
                  role="img"
                  aria-label={`Score ${skill.githubScore.toFixed(0)} out of 100`}
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                >
                  <motion.i
                    className="nx-score-fill block h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${Math.min(Math.max(skill.githubScore, 0), 100)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      ) : null}

      {/* How this is calculated */}
      <motion.details variants={fadeUp} className="nx-card group rounded-2xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 [&::-webkit-details-marker]:hidden">
          <span>
            How this is calculated
            <span className="ml-2 text-xs font-normal text-slate-500">Benchmark v{analysis.baseline.version} · {demandLabel(demand)}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            Baseline: role benchmark v{analysis.baseline.version}
            {" · "}Employer demand: {demandLabel(demand)}.
            {demand.note}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            {analysis.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
          </ul>
        </div>
      </motion.details>
    </motion.div>
  );
}
