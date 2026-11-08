import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client";
import type { CareerProfileResponse, OpportunitySearchResponse, TransitionAnalysis } from "../../api/career-types";
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { useToast } from "../../context/ToastContext";
import { GapList, ProgressSummary } from "./DevelopmentPage";
import { RefreshPanel } from "./RefreshPanel";
import { JobCard } from "./jobParts";
import { useAuth } from "../../auth/AuthContext";
import {
  IconCode,
  IconStar,
  IconTarget,
  IconBriefcase,
  IconArrowRight,
  IconCheck,
  IconAlert,
} from "../../components/Icons";

// ── Status dot ─────────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`}
    />
  );
}

// ── Intelligence summary cards ─────────────────────────────────────────────────

function IntelligenceSummary({ data }: { data: CareerProfileResponse }) {
  const direction = data.learning.direction ?? data.preferences.directions[0] ?? null;
  const directionName = data.directions.find((o) => o.id === direction)?.displayName;

  const cards = [
    {
      icon: <IconCode className="h-4 w-4" />,
      label: "GitHub Evidence",
      value: data.evidence.hasGithubAnalysis ? "Analyzed" : "Not analyzed",
      ok: data.evidence.hasGithubAnalysis,
      detail: data.evidence.githubAnalyzedAt
        ? `Last run ${new Date(data.evidence.githubAnalyzedAt).toLocaleDateString()}`
        : "Connect your repositories to begin",
      link: "/repositories",
      linkLabel: data.evidence.hasGithubAnalysis ? "View evidence" : "Get started",
    },
    {
      icon: <IconTarget className="h-4 w-4" />,
      label: "Target Role",
      value: directionName ?? "No career direction chosen",
      ok: !!directionName,
      detail: directionName ? "Role selected" : "Choose a career direction",
      link: "/development",
      linkLabel: directionName ? "View gaps" : "Choose direction",
    },
    {
      icon: <IconStar className="h-4 w-4" />,
      label: "Skills",
      value: data.evidence.hasGithubAnalysis ? "Scored" : "Pending",
      ok: data.evidence.hasGithubAnalysis,
      detail: data.evidence.hasGithubAnalysis ? "From GitHub evidence" : "Run analysis to score skills",
      link: "/skills",
      linkLabel: "View skills",
    },
    {
      icon: <IconBriefcase className="h-4 w-4" />,
      label: "Resume",
      value: data.resume ? `v${data.resume.version}` : "Resume: none yet",
      ok: !!data.resume,
      detail: data.resume
        ? `Saved ${new Date(data.resume.savedAt).toLocaleDateString()}`
        : "Upload for stronger matching",
      link: "/resume",
      linkLabel: data.resume ? "Manage" : "Upload resume",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={card.ok ? "text-emerald-500" : "text-slate-400"}>
                {card.icon}
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
            </div>
            <StatusDot ok={card.ok} />
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">{card.value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{card.detail}</p>
          <Link
            to={card.link}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded"
          >
            {card.linkLabel}
            <IconArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}

// ── Next actions ────────────────────────────────────────────────────────────────

function NextActions({ data }: { data: CareerProfileResponse }) {
  const direction = data.learning.direction ?? data.preferences.directions[0] ?? null;

  const actions = [
    !data.evidence.hasGithubAnalysis && {
      to: "/repositories",
      label: "Analyze GitHub repositories",
      desc: "Connect your repos to get skill evidence",
      primary: true,
    },
    !direction && {
      to: "/development",
      label: "Choose a career direction",
      desc: "Target a role to see your skill gaps",
      primary: !data.evidence.hasGithubAnalysis ? false : true,
    },
    {
      to: "/opportunities",
      label: "Search opportunities",
      desc: "Browse jobs matched to your evidence",
      primary: data.evidence.hasGithubAnalysis && !!direction,
    },
    {
      to: "/copilot",
      label: "Ask Career Copilot",
      desc: "Get personalized guidance",
      primary: false,
    },
  ].filter(Boolean) as Array<{ to: string; label: string; desc: string; primary: boolean }>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.slice(0, 4).map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className={[
            "group flex flex-col rounded-xl border p-3.5 transition-all",
            "hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
            action.primary
              ? "border-indigo-200 bg-indigo-50 text-indigo-900"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
          ].join(" ")}
        >
          <p className="text-sm font-semibold">{action.label}</p>
          <p className={`mt-0.5 text-xs ${action.primary ? "text-indigo-700/80" : "text-slate-500"}`}>
            {action.desc}
          </p>
        </Link>
      ))}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();
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

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1
          className="font-display text-slate-900"
          style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}
        >
          {greeting}, {name}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {data.evidence.hasGithubAnalysis
            ? "Your career intelligence is ready. Here's your current status."
            : "Let's set up your career intelligence. Start by connecting your GitHub repositories."}
        </p>
      </div>

      {/* Evidence refresh + intelligence summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Intelligence status</h2>
          <Link
            to="/repositories"
            className="text-xs font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded"
          >
            Manage evidence
          </Link>
        </div>
        <IntelligenceSummary data={data} />
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
      </div>

      {/* Recommended opportunities */}
      <section aria-label="Recommended opportunities">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recommended opportunities</h2>
          <Link
            to="/opportunities"
            className="text-xs font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded"
          >
            See all
          </Link>
        </div>
        {jobs.state.status === "loading" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CardSkeleton /><CardSkeleton />
          </div>
        ) : jobs.state.status === "error" ? (
          <ErrorState error={jobs.state.error} onRetry={jobs.reload} />
        ) : jobs.state.status === "success" ? (
          jobs.state.data.noProviderConfigured ? (
            <EmptyState title="No live job provider configured">
              Real listings need a provider key on the server.{" "}
              <Link to="/opportunities?source=demo" className="underline text-indigo-700">Explore demo listings</Link>.
            </EmptyState>
          ) : jobs.state.data.items.length === 0 ? (
            <EmptyState title="No opportunities found">
              Try searching on the{" "}
              <Link to="/opportunities" className="underline text-indigo-700">Job Discovery</Link> page.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {jobs.state.data.items.slice(0, 4).map((item) => (
                <li key={item.job.id}><JobCard item={item} /></li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {/* Skill plan summary */}
      {direction ? (
        <section aria-label="Skill gaps and learning progress">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Skill plan</h2>
            <Link
              to="/development"
              className="text-xs font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded"
            >
              Full plan
            </Link>
          </div>
          {plan.state.status === "loading" ? (
            <LoadingState label="Building your plan…" />
          ) : plan.state.status === "error" ? (
            <ErrorState error={plan.state.error} onRetry={plan.reload} />
          ) : plan.state.data ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 nx-panel">
                <p className="text-sm text-indigo-900">
                  <span className="font-semibold">Next action: </span>
                  {plan.state.data.nextAction}
                </p>
              </div>
              <ProgressSummary analysis={plan.state.data} />
              <GapList analysis={{ ...plan.state.data, gaps: plan.state.data.gaps.slice(0, 3) }} />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Next actions */}
      <section aria-label="Next actions">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">What would you like to do?</h2>
        <NextActions data={data} />
      </section>
    </div>
  );
}
