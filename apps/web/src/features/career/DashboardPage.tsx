import { Link } from "react-router-dom";
import { apiGet } from "../../api/client";
import type { CareerProfileResponse, OpportunitySearchResponse, TransitionAnalysis } from "../../api/career-types";
import { CardSkeleton, EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { GapList, ProgressSummary } from "./DevelopmentPage";
import { RefreshPanel } from "./RefreshPanel";
import { JobCard } from "./jobParts";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
      {ok ? "✓" : "–"} {label}
    </span>
  );
}

function ProfileSection({ data }: { data: CareerProfileResponse }) {
  const direction = data.learning.direction ?? data.preferences.directions[0] ?? null;
  const directionName = data.directions.find((o) => o.id === direction)?.displayName;
  const prefsSet = data.preferences.employmentTypes.length + data.preferences.workModes.length + data.preferences.locations.length > 0;

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
      detail: data.resume ? `version ${data.resume.version}, saved ${new Date(data.resume.savedAt).toLocaleDateString()}` : "Resume: none yet",
      link: "/resume",
      linkLabel: data.resume ? "Manage" : "Add resume",
    },
    {
      label: "Career direction",
      ok: !!directionName,
      detail: directionName ?? "not chosen (optional)",
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Profile status</h2>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <StatusPill ok={row.ok} label={row.label} />
              <p className="mt-0.5 truncate text-xs text-slate-500">{row.detail}</p>
            </div>
            <Link
              to={row.link}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
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
    { to: "/opportunities", label: "Search opportunities", desc: "Browse jobs matched to your evidence" },
    { to: "/copilot", label: "Ask Copilot", desc: "Get personalized career guidance" },
    { to: "/applications", label: "My applications", desc: "Track your job applications" },
    { to: "/repositories", label: "Manage repositories", desc: "Choose repos for analysis" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="group rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:border-indigo-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
        >
          <p className="text-sm font-medium text-slate-900 group-hover:text-indigo-700">{action.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{action.desc}</p>
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
  const directionName = data.directions.find((o) => o.id === direction)?.displayName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">Your evidence, opportunities, and next steps.</p>
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
          <Link to="/opportunities" className="text-sm font-medium text-indigo-700 hover:underline">See all</Link>
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
              Real listings need a provider key on the server. You can{" "}
              <Link to="/opportunities?source=demo" className="underline">explore demo listings</Link>.
            </EmptyState>
          ) : jobs.state.data.items.length === 0 ? (
            <EmptyState title="No opportunities found">
              Try different filters on the <Link to="/opportunities" className="underline">Opportunities</Link> page.
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
          <Link to="/development" className="text-sm font-medium text-indigo-700 hover:underline">Open plan</Link>
        </div>
        {!direction ? (
          <EmptyState title="No career direction chosen">
            Choose one on the <Link to="/development" className="underline">Development</Link> page for a prioritized plan, or ask the{" "}
            <Link to="/copilot" className="underline">Copilot</Link>.
          </EmptyState>
        ) : plan.state.status === "loading" ? (
          <LoadingState label="Building your plan..." />
        ) : plan.state.status === "error" ? (
          <ErrorState error={plan.state.error} onRetry={plan.reload} />
        ) : plan.state.data ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p className="text-sm text-indigo-900"><strong>Next action:</strong> {plan.state.data.nextAction}</p>
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
