import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";
import type { CareerProfileResponse, OpportunitySearchResponse, TransitionAnalysis } from "../../api/career-types";
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { GapList, ProgressSummary } from "./DevelopmentPage";
import { RefreshPanel } from "./RefreshPanel";
import { JobCard } from "./jobParts";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-400"}`}
    />
  );
}

function ProfileSection({ data }: { data: CareerProfileResponse }) {
  const direction = data.learning.direction ?? data.preferences.directions[0] ?? null;
  const directionName = data.directions.find((o) => o.id === direction)?.displayName;
  const prefsSet =
    data.preferences.employmentTypes.length +
      data.preferences.workModes.length +
      data.preferences.locations.length >
    0;

  const rows = [
    {
      label: "GitHub analysis",
      ok: data.evidence.hasGithubAnalysis,
      detail: data.evidence.hasGithubAnalysis
        ? `Analyzed ${data.evidence.githubAnalyzedAt ? new Date(data.evidence.githubAnalyzedAt).toLocaleDateString() : ""}`
        : "Not analyzed yet",
      link: "/repositories",
      linkLabel: data.evidence.hasGithubAnalysis ? "Manage" : "Analyze",
    },
    {
      label: "Resume",
      ok: data.evidence.hasResume,
      detail: data.resume
        ? `v${data.resume.version} · saved ${new Date(data.resume.savedAt).toLocaleDateString()}`
        : "none yet",
      link: "/resume",
      linkLabel: data.resume ? "Manage" : "Add resume",
    },
    {
      label: "Career direction",
      ok: !!directionName,
      detail: directionName ?? "Not chosen (optional)",
      link: "/development",
      linkLabel: directionName ? "Change" : "Choose",
    },
    {
      label: "Preferences",
      ok: prefsSet,
      detail: prefsSet ? "Configured" : "Not set",
      link: "/preferences",
      linkLabel: prefsSet ? "Edit" : "Set up",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Profile status</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusDot ok={row.ok} />
              <p className="truncate text-sm text-slate-700">{`${row.label}: ${row.detail}`}</p>
            </div>
            <Link
              to={row.link}
              className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
            >
              {row.linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickActions() {
  const actions = [
    {
      to: "/opportunities",
      label: "Search opportunities",
      desc: "Browse jobs matched to your evidence",
      primary: true,
    },
    {
      to: "/copilot",
      label: "Ask Copilot",
      desc: "Get personalized career guidance",
      primary: false,
    },
    {
      to: "/applications",
      label: "My applications",
      desc: "Track your job applications",
      primary: false,
    },
    {
      to: "/repositories",
      label: "Manage repositories",
      desc: "Choose repos for analysis",
      primary: false,
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className={[
            "group flex flex-col rounded-xl border p-3.5 transition-all",
            "hover:border-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700",
            action.primary
              ? "border-indigo-200 bg-indigo-50 text-indigo-900"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
          ].join(" ")}
        >
          <p className="text-sm font-semibold">{action.label}</p>
          <p className={`mt-0.5 text-xs ${action.primary ? "text-indigo-700 opacity-80" : "text-slate-500"}`}>
            {action.desc}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function DashboardPage() {
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

  if (profile.state.status === "loading") return <LoadingState label="Loading your dashboard..." />;
  if (profile.state.status === "error") return <ErrorState error={profile.state.error} onRetry={profile.reload} />;

  const data = profile.state.data;

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Your evidence, opportunities, and next steps.
        </p>
      </div>

      {/* Evidence refresh + profile status */}
      <div className="grid gap-4 md:grid-cols-2">
        <RefreshPanel
          evidence={data.evidence}
          refresh={data.refresh}
          onDone={() => { profile.reload(); jobs.reload(); plan.reload(); }}
        />
        <ProfileSection data={data} />
      </div>

      {/* Recommended opportunities */}
      <section aria-label="Recommended opportunities">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recommended opportunities</h2>
          <Link
            to="/opportunities"
            className="text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            See all
          </Link>
        </div>
        {jobs.state.status === "loading" ? (
          <div className="grid gap-3 md:grid-cols-2">
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
              Try different filters on the{" "}
              <Link to="/opportunities" className="underline text-indigo-700">Opportunities</Link> page.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {jobs.state.data.items.slice(0, 4).map((item) => (
                <li key={item.job.id}><JobCard item={item} /></li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {/* Skill plan summary */}
      <section aria-label="Skill gaps and learning progress">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Skill plan</h2>
          <Link
            to="/development"
            className="text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            Open plan
          </Link>
        </div>
        {!direction ? (
          <EmptyState title="No career direction chosen">
            Choose one on the{" "}
            <Link to="/development" className="underline text-indigo-700">Development</Link> page for a
            prioritized plan, or ask the{" "}
            <Link to="/copilot" className="underline text-indigo-700">Copilot</Link>.
          </EmptyState>
        ) : plan.state.status === "loading" ? (
          <LoadingState label="Building your plan..." />
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

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Quick actions</h2>
        <QuickActions />
      </section>
    </div>
  );
}
