import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import type { GapAnalysisResponse, RoleCatalogResponse, RoleDefinition } from "../../api/types";
import type { ResourceState } from "../../hooks/useApiResource";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { formatPercent, formatScore } from "../../lib/format";
import { GapResultView } from "./GapResultView";

export type GapRunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; error: ApiError }
  | { status: "done"; result: GapAnalysisResponse };

interface Props {
  roles: ResourceState<RoleCatalogResponse>;
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
  onRun: () => void;
  onRetryRoles: () => void;
  run: GapRunState;
}

function RoleRequirements({ role }: { role: RoleDefinition }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Required skills for {role.displayName}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-slate-700">
            <th scope="col" className="p-2 font-medium">Required skill</th>
            <th scope="col" className="p-2 font-medium">Weight</th>
            <th scope="col" className="p-2 font-medium">Minimum Evidence Score</th>
          </tr>
        </thead>
        <tbody>
          {role.requirements.map((requirement) => (
            <tr key={requirement.skillId}>
              <th scope="row" className="p-2 font-normal text-slate-900">{requirement.skillName}</th>
              <td className="p-2 tabular-nums">{formatPercent(requirement.weight)}</td>
              <td className="p-2 tabular-nums">{formatScore(requirement.minimumScore)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunFeedback({ run }: { run: GapRunState }) {
  if (run.status === "error") {
    if (run.error.code === "NO_ANALYSIS") {
      return (
        <EmptyState title="Not yet analyzed">
          <p>
            No scoring run exists yet, so there are no Evidence Scores to compare. Score your collected evidence from
            the <Link to="/" className="underline">skill overview</Link> first.
          </p>
        </EmptyState>
      );
    }
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        Gap analysis failed: {describeError(run.error)}
      </div>
    );
  }
  if (run.status === "running") {
    return <p role="status" className="text-sm text-slate-700">Running gap analysis...</p>;
  }
  if (run.status === "done") {
    return <GapResultView result={run.result} />;
  }
  return null;
}

export function RolesView({ roles, selectedRoleId, onSelect, onRun, onRetryRoles, run }: Props) {
  if (roles.status === "loading") return <LoadingState label="Loading roles..." />;
  if (roles.status === "error") return <ErrorState error={roles.error} onRetry={onRetryRoles} />;

  const list = roles.data.roles;
  if (list.length === 0) {
    return <EmptyState title="No roles are configured" />;
  }

  const selected = list.find((role) => role.id === selectedRoleId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Target role</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Choose a role to compare your Evidence Scores with. These benchmarks are manually curated v1 requirements
          (catalog v{roles.data.catalogVersion}), not live market data or universal hiring standards.
        </p>
      </header>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-900">Select one role</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white p-3 has-[:checked]:border-indigo-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-700"
            >
              <input
                type="radio"
                name="target-role"
                value={role.id}
                checked={role.id === selectedRoleId}
                onChange={() => onSelect(role.id)}
              />
              <span className="font-medium text-slate-900">{role.displayName}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected ? (
        <section aria-labelledby="requirements-title" className="space-y-3">
          <h2 id="requirements-title" className="text-lg font-semibold text-slate-900">
            What {selected.displayName} evaluates
          </h2>
          <RoleRequirements role={selected} />
          <button
            type="button"
            onClick={onRun}
            disabled={run.status === "running"}
            className="rounded-md bg-indigo-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
          >
            {run.status === "running" ? "Running..." : "Run gap analysis"}
          </button>
        </section>
      ) : (
        <p className="text-sm text-slate-600">Select a role to see its requirements.</p>
      )}

      <RunFeedback run={run} />
    </div>
  );
}
