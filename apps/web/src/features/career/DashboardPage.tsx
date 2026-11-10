import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  Check,
  FileText,
  GitBranch,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { apiGet } from "../../api/client";
import type {
  CareerProfileResponse,
  OpportunityItem,
  OpportunitySearchResponse,
  TransitionAnalysis,
} from "../../api/career-types";
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { useToast } from "../../context/ToastContext";
import { GapList, ProgressSummary } from "./DevelopmentPage";
import { RefreshPanel } from "./RefreshPanel";
import { JobCard, MatchBadge, SourceBadge, JobMeta, skillLabel } from "./jobParts";
import { useAuth } from "../../auth/AuthContext";
import { CountUp, HeroGlow, Ring, SKILL_STATUS, heroShell } from "./spotlight";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      {linkTo && linkLabel ? (
        <Link
          to={linkTo}
          className="rounded text-xs font-semibold text-indigo-700 transition-colors hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}

// ── Journey: evidence → role → skills → resume → matches ───────────────────────

interface Step {
  key: string;
  label: string;
  value: string;
  detail: string;
  done: boolean;
  icon: LucideIcon;
  to: string;
}

function buildSteps(data: CareerProfileResponse, matchCount: number | null, topScore: number | null): Step[] {
  const direction = data.learning.direction ?? data.preferences.directions[0] ?? null;
  const directionName = data.directions.find((o) => o.id === direction)?.displayName;
  const analyzed = data.evidence.hasGithubAnalysis;

  return [
    {
      key: "evidence",
      label: "GitHub evidence",
      value: analyzed ? "Analyzed" : "Not analyzed",
      detail: data.evidence.githubAnalyzedAt
        ? `Run ${new Date(data.evidence.githubAnalyzedAt).toLocaleDateString()}`
        : "Connect your repositories",
      done: analyzed,
      icon: GitBranch,
      to: "/repositories",
    },
    {
      key: "role",
      label: "Target role",
      value: directionName ?? "No career direction chosen",
      detail: directionName ? "Role selected" : "Choose a direction",
      done: !!directionName,
      icon: Target,
      to: "/development",
    },
    {
      key: "skills",
      label: "Skills",
      value: analyzed ? "Scored" : "Pending",
      detail: analyzed ? "From GitHub evidence" : "Run an analysis first",
      done: analyzed,
      icon: Sparkles,
      to: "/skills",
    },
    {
      key: "resume",
      label: "Resume",
      value: data.resume ? `v${data.resume.version}` : "Resume: none yet",
      detail: data.resume ? `Saved ${new Date(data.resume.savedAt).toLocaleDateString()}` : "Upload for stronger matching",
      done: !!data.resume,
      icon: FileText,
      to: "/resume",
    },
    {
      key: "matches",
      label: "Matches",
      value: matchCount === null ? "Loading…" : matchCount > 0 ? `${matchCount} to review` : "None yet",
      detail: topScore !== null ? `Top score ${topScore}` : "Jobs ranked on your evidence",
      done: false, // an ongoing activity, never "finished"
      icon: Search,
      to: "/opportunities",
    },
  ];
}

function JourneyRail({ steps }: { steps: Step[] }) {
  // The current step is the first setup step that is not done, otherwise Matches.
  const firstOpen = steps.findIndex((s, i) => i < steps.length - 1 && !s.done);
  const currentIndex = firstOpen === -1 ? steps.length - 1 : firstOpen;

  return (
    <nav aria-label="Your journey" className="nx-card rounded-3xl border border-slate-200 bg-white px-3 py-5 sm:px-5 sm:py-6">
      <ol className="grid gap-1 sm:grid-cols-5 sm:gap-0">
        {steps.map((step, i) => {
          const state = step.done ? "done" : i === currentIndex ? "now" : "todo";
          const Icon = step.icon;
          const segmentDone = step.done; // line from this node to the next fills once this one is done
          return (
            <li key={step.key} className="relative">
              {/* connector to the next node (desktop) */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-[22px] hidden h-[3px] w-full -translate-y-1/2 overflow-hidden rounded-full bg-slate-200 sm:block"
                >
                  <motion.span
                    className="block h-full rounded-full bg-gradient-to-r from-indigo-700 to-indigo-400"
                    initial={{ width: "0%" }}
                    animate={{ width: segmentDone ? "100%" : "0%" }}
                    transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: "easeOut" }}
                  />
                </span>
              )}
              <Link
                to={step.to}
                aria-current={state === "now" ? "step" : undefined}
                className="group relative z-10 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 sm:flex-col sm:gap-2 sm:text-center"
              >
                <span
                  className={[
                    "relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-white transition-transform duration-200 group-hover:scale-105",
                    state === "done" && "bg-indigo-700 text-[var(--color-indigo-950)]",
                    state === "now" && "bg-[oklch(62%_0.17_36)] text-white shadow-[0_0_0_6px_oklch(70%_0.148_36_/_0.2)]",
                    state === "todo" && "bg-slate-100 text-slate-400 ring-1 ring-slate-200",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {state === "done" ? (
                    <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{step.label}</span>
                  <span
                    className={`mt-0.5 block text-sm font-semibold leading-tight ${
                      state === "todo" ? "text-slate-500" : "text-slate-900"
                    }`}
                  >
                    {step.value}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{step.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Spotlight hero ─────────────────────────────────────────────────────────────

function TopMatchHero({ item }: { item: OpportunityItem }) {
  const { job, match } = item;
  const required = match.skills.filter((s) => s.requirement === "required");
  const supported = required.filter((s) => s.status === "github");
  const skillRows = [...required, ...match.skills.filter((s) => s.requirement !== "required")].slice(0, 4);
  const score = match.score;

  return (
    <motion.section variants={fadeUp} aria-label="Top match" className={`${heroShell} grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,19rem)] lg:items-center lg:gap-8`}>
      <HeroGlow />
      <div className="relative">
        <Ring progress={score !== null ? score / 100 : 0}>
          <span className="font-display text-[3.4rem] leading-none text-[var(--color-indigo-950)]">
            {score !== null ? <CountUp value={score} /> : "—"}
          </span>
        </Ring>
      </div>

      <div className="relative min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">Your top match</p>
        <h2 className="font-display mt-1 text-[2.2rem] leading-[0.95] tracking-tight text-[var(--color-indigo-950)]">{job.title}</h2>
        <p className="mt-1.5 text-sm text-indigo-100/90">{job.company ?? "Company not provided"}</p>
        <div className="mt-2 text-indigo-100/80 [&_p]:text-indigo-100/80">
          <JobMeta job={job} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MatchBadge match={match} />
          <SourceBadge job={job} />
        </div>
        {required.length > 0 && (
          <p className="mt-3 text-xs text-indigo-100/80">
            <span className="font-semibold tabular-nums text-white">{supported.length}</span> of{" "}
            <span className="font-semibold tabular-nums text-white">{required.length}</span> required skills supported by GitHub evidence.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 rounded-full bg-[oklch(62%_0.17_36)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800"
          >
            {job.isDemo ? "Open example page" : "Open original listing"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <Link
            to="/opportunities"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            All matches
          </Link>
        </div>
      </div>

      <div className="relative min-w-0 rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-200">Skill check</p>
        {skillRows.length === 0 ? (
          <p className="text-sm text-indigo-100/80">No skill requirements were listed for this role.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {skillRows.map((s) => {
              const meta = SKILL_STATUS[s.status] ?? SKILL_STATUS.missing!;
              return (
                <li key={s.skill} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="truncate font-medium capitalize">{skillLabel(s.skill)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-indigo-100/75">{meta.text}</span>
                </li>
              );
            })}
          </ul>
        )}
        {match.hardBlockers.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-amber-200">Blocker: {match.hardBlockers[0]}</p>
        )}
      </div>
    </motion.section>
  );
}

/** Shown when there is no job to spotlight yet: the next setup step, with a progress ring. */
function NextMoveHero({ steps }: { steps: Step[] }) {
  const setup = steps.slice(0, 4);
  const doneCount = setup.filter((s) => s.done).length;
  const open = setup.find((s) => !s.done);

  const move = open
    ? {
        evidence: { title: "Analyze your GitHub repositories", desc: "Connect your repos so NEXUS can score your skills from real code.", cta: "Analyze repositories" },
        role: { title: "Choose a career direction", desc: "Pick a target role to see exactly which skills you still need.", cta: "Choose direction" },
        skills: { title: "Score your skills", desc: "Run an analysis to turn your repositories into skill evidence.", cta: "Analyze repositories" },
        resume: { title: "Add your resume", desc: "Upload it for stronger, more accurate job matching.", cta: "Upload resume" },
      }[open.key]!
    : { title: "Your profile is ready", desc: "Browse jobs ranked on your real evidence.", cta: "Search opportunities" };
  const to = open ? open.to : "/opportunities";

  return (
    <motion.section variants={fadeUp} aria-label="Your next move" className={`${heroShell} grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-8`}>
      <HeroGlow />
      <div className="relative">
        <Ring progress={doneCount / 4}>
          <span className="font-display text-[3rem] leading-none text-[var(--color-indigo-950)]">
            {doneCount}
            <span className="text-2xl text-indigo-200">/4</span>
          </span>
        </Ring>
      </div>
      <div className="relative min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">Your next move</p>
        <h2 className="font-display mt-1 text-[2.2rem] leading-[0.95] tracking-tight">{move.title}</h2>
        <p className="mt-2 max-w-xl text-sm text-indigo-100/85">{move.desc}</p>
        <Link
          to={to}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[oklch(62%_0.17_36)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-800"
        >
          {move.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.section>
  );
}

// ── Actions ────────────────────────────────────────────────────────────────────

interface Action {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

function buildActions(data: CareerProfileResponse, direction: string | null): Action[] {
  const pool: Array<Action | false> = [
    !data.evidence.hasGithubAnalysis && { to: "/repositories", label: "Analyze GitHub repositories", desc: "Get skill evidence from your repos", icon: GitBranch },
    !direction && { to: "/development", label: "Choose a career direction", desc: "Target a role to see your skill gaps", icon: Target },
    !data.resume && { to: "/resume", label: "Upload your resume", desc: "Stronger, more accurate matching", icon: FileText },
    { to: "/opportunities", label: "Search opportunities", desc: "Browse jobs matched to your evidence", icon: Search },
    { to: "/copilot", label: "Ask Career Copilot", desc: "Get personalized guidance", icon: MessageSquare },
    { to: "/saved", label: "Saved opportunities", desc: "Jobs you're considering", icon: Bookmark },
    { to: "/skills", label: "View your skills", desc: "See how each skill is scored", icon: Sparkles },
  ];
  return pool.filter(Boolean).slice(0, 4) as Action[];
}

/** Always four tiles (see buildActions), so the row is filled edge to edge at every size. */
function NextActions({ actions }: { actions: Action[] }) {
  return (
    <section aria-label="Next actions">
      <SectionHeader title="What would you like to do?" />
      <ul className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <li key={action.to} className="flex">
              <Link
                to={action.to}
                className={[
                  "group flex w-full flex-col rounded-2xl border p-4 transition-all",
                  "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
                  i === 0
                    ? "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"
                    : "border-slate-200 bg-white hover:border-indigo-200",
                ].join(" ")}
              >
                <span className="mb-4 flex items-start justify-between">
                  <span
                    aria-hidden="true"
                    className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                      i === 0
                        ? "bg-indigo-700 text-[var(--color-indigo-950)] shadow-[0_8px_16px_-8px_rgba(14,79,74,0.7)]"
                        : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-700"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-700" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-slate-900">{action.label}</span>
                <span className="mt-1 text-xs leading-relaxed text-slate-500">{action.desc}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

/** Column count follows the item count so every row is filled edge to edge. */
function gridColsFor(count: number) {
  return count >= 3 ? "xl:grid-cols-3" : count === 2 ? "sm:grid-cols-2" : "";
}

export function DashboardPage() {
  const toast = useToast();
  const { state: authState } = useAuth();
  const username = authState.status === "authenticated" ? authState.user.username : null;

  const profile = useApiResource(() => apiGet<CareerProfileResponse>("/api/career/profile"), []);
  const jobs = useApiResource(() => apiGet<OpportunitySearchResponse>("/api/opportunities?limit=10"), []);

  const direction =
    profile.state.status === "success"
      ? (profile.state.data.learning.direction ?? profile.state.data.preferences.directions[0] ?? null)
      : null;

  const plan = useApiResource(
    () =>
      direction
        ? apiGet<TransitionAnalysis>(`/api/career/transition?direction=${encodeURIComponent(direction)}`)
        : Promise.resolve(null),
    [direction],
  );

  if (profile.state.status === "loading") return <LoadingState label="Loading your overview…" />;
  if (profile.state.status === "error") return <ErrorState error={profile.state.error} onRetry={profile.reload} />;

  const data = profile.state.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = username ?? "there";

  // Best match first; the rest fill the row below the hero.
  const items = jobs.state.status === "success" && !jobs.state.data.noProviderConfigured ? jobs.state.data.items : [];
  const ranked = [...items].sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1));
  const best = ranked[0] ?? null;
  const others = ranked.slice(1, 4);

  const steps = buildSteps(data, jobs.state.status === "success" ? items.length : null, best?.match.score ?? null);
  const actions = buildActions(data, direction);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8">
      {/* Page header */}
      <motion.div variants={fadeUp}>
        <h1 className="font-display text-slate-900" style={{ fontSize: "2.2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
          {greeting}, <span className="nx-gradient-text">{name}</span>
        </h1>
        <p className="mt-2 max-w-lg text-sm text-slate-500">
          {data.evidence.hasGithubAnalysis
            ? "Your career intelligence is ready. Here's your current status."
            : "Let's set up your career intelligence. Start by connecting your GitHub repositories."}
        </p>
      </motion.div>

      {/* Journey */}
      <motion.section variants={fadeUp} aria-label="Intelligence status">
        <JourneyRail steps={steps} />
      </motion.section>

      {/* Spotlight */}
      {best ? <TopMatchHero item={best} /> : jobs.state.status === "loading" ? (
        <div className="skeleton h-[22rem] rounded-3xl lg:h-72" aria-hidden="true" />
      ) : (
        <NextMoveHero steps={steps} />
      )}

      {/* Recommended opportunities */}
      {jobs.state.status === "loading" ? (
        <section aria-label="Recommended opportunities">
          <SectionHeader title="Recommended opportunities" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
        </section>
      ) : jobs.state.status === "error" ? (
        <section aria-label="Recommended opportunities">
          <SectionHeader title="Recommended opportunities" linkTo="/opportunities" linkLabel="See all" />
          <ErrorState error={jobs.state.error} onRetry={jobs.reload} />
        </section>
      ) : jobs.state.status === "success" ? (
        jobs.state.data.noProviderConfigured ? (
          <section aria-label="Recommended opportunities">
            <SectionHeader title="Recommended opportunities" />
            <EmptyState title="No live job provider configured">
              Real listings need a provider key on the server.{" "}
              <Link to="/opportunities?source=demo" className="text-indigo-700 underline">Explore demo listings</Link>.
            </EmptyState>
          </section>
        ) : jobs.state.data.items.length === 0 ? (
          <section aria-label="Recommended opportunities">
            <SectionHeader title="Recommended opportunities" />
            <EmptyState title="No opportunities found">
              Try searching on the{" "}
              <Link to="/opportunities" className="text-indigo-700 underline">Job Discovery</Link> page.
            </EmptyState>
          </section>
        ) : others.length > 0 ? (
          <motion.section variants={fadeUp} aria-label="Recommended opportunities">
            <SectionHeader title="More opportunities" linkTo="/opportunities" linkLabel="See all" />
            <ul className={`grid grid-cols-1 items-stretch gap-3 ${gridColsFor(others.length)}`}>
              {others.map((item) => (
                <li key={item.job.id} className="flex [&>article]:min-w-0 [&>article]:flex-1">
                  <JobCard item={item} />
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null
      ) : null}

      {/* Skill plan */}
      {direction ? (
        <motion.section variants={fadeUp} aria-label="Skill gaps and learning progress">
          <SectionHeader title="Skill plan" linkTo="/development" linkLabel="Full plan" />
          {plan.state.status === "loading" ? (
            <LoadingState label="Building your plan…" />
          ) : plan.state.status === "error" ? (
            <ErrorState error={plan.state.error} onRetry={plan.reload} />
          ) : plan.state.data ? (
            <div className="space-y-3">
              <div className="nx-panel rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-3.5">
                <p className="text-sm text-indigo-900">
                  <span className="font-semibold">Next action: </span>
                  {plan.state.data.nextAction}
                </p>
              </div>
              <ProgressSummary analysis={plan.state.data} />
              <GapList analysis={{ ...plan.state.data, gaps: plan.state.data.gaps.slice(0, 3) }} layout="grid" />
            </div>
          ) : null}
        </motion.section>
      ) : null}

      {/* What would you like to do? — four equal tiles */}
      <motion.div variants={fadeUp}>
        <NextActions actions={actions} />
      </motion.div>

      {/* GitHub evidence + refresh */}
      <motion.div variants={fadeUp}>
        <RefreshPanel
          evidence={data.evidence}
          refresh={data.refresh}
          onDone={() => {
            profile.reload();
            jobs.reload();
            plan.reload();
            toast({ variant: "success", title: "Profile refreshed", description: "Your evidence and recommendations have been updated." });
          }}
        />
      </motion.div>
    </motion.div>
  );
}
