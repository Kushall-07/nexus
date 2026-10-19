import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../../api/client";
import type { GapAnalysisResponse, RoleCatalogResponse, RoleRequirementResult } from "../../api/types";
import { GapResultView } from "./GapResultView";
import { RolesView, type GapRunState } from "./RolesView";

const noop = () => undefined;
const render = (node: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

const catalog: RoleCatalogResponse = {
  catalogVersion: "1.0.0",
  roles: ["Software Engineer", "Full-Stack Developer", "Backend Engineer", "AI Engineer", "ML Engineer"].map((name, index) => ({
    id: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    displayName: name,
    requirements: [
      { skillId: "python", skillName: "Python", weight: 0.6, minimumScore: 50 },
      { skillId: `skill-${index}`, skillName: `Skill ${index}`, weight: 0.4, minimumScore: 40 },
    ],
  })),
};

function requirement(overrides: Partial<RoleRequirementResult>): RoleRequirementResult {
  return {
    skillId: "python",
    skillName: "Python",
    evidenceScore: 42,
    evidenceAvailable: true,
    weight: 0.6,
    minimumScore: 60,
    weightedContribution: 25.2,
    gap: -18,
    deficit: 18,
    criticalGap: true,
    ...overrides,
  };
}

function resultOf(requirements: RoleRequirementResult[], roleMatch = 61.234): GapAnalysisResponse {
  return {
    id: "g1",
    analysisId: "a1",
    scoringVersion: "1.0.0",
    roleCatalogVersion: "1.0.0",
    createdAt: "2026-03-02T00:00:00.000Z",
    roleId: "ai-engineer",
    roleName: "AI Engineer",
    roleMatch,
    requirements,
    criticalGaps: requirements.filter((entry) => entry.criticalGap),
  };
}

const view = (overrides: Partial<Parameters<typeof RolesView>[0]> = {}) =>
  render(
    <RolesView
      roles={{ status: "success", data: catalog }}
      selectedRoleId={null}
      onSelect={noop}
      onRun={noop}
      onRetryRoles={noop}
      run={{ status: "idle" }}
      {...overrides}
    />,
  );

describe("RolesView", () => {
  it("offers exactly the five backend roles as radio options", () => {
    const html = view();

    expect((html.match(/type="radio"/g) ?? []).length).toBe(5);
    for (const name of catalog.roles.map((role) => role.displayName)) {
      expect(html).toContain(name);
    }
  });

  it("states that benchmarks are manually curated v1 requirements", () => {
    expect(view()).toContain("manually curated v1 requirements");
  });

  it("marks the selected role and shows its backend-provided requirements", () => {
    const html = view({ selectedRoleId: "ai-engineer" });

    expect(html).toContain("What AI Engineer evaluates");
    expect(html).toContain("60%");
    expect(html).toContain("50.0");
    expect(html).toContain("Run gap analysis");
    const checked = html.match(/<input[^>]*checked[^>]*>/g) ?? [];
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="ai-engineer"');
  });

  it("hides requirements and the run button until a role is selected", () => {
    const html = view();

    expect(html).toContain("Select a role to see its requirements.");
    expect(html).not.toContain("Run gap analysis");
  });

  it("disables the run button while a request is in flight", () => {
    const html = view({ selectedRoleId: "ai-engineer", run: { status: "running" } });

    expect(html).toMatch(/<button[^>]*disabled[^>]*>Running\.\.\.<\/button>/);
  });

  it("renders loading, error and empty role states", () => {
    expect(view({ roles: { status: "loading" } })).toContain("Loading roles");
    expect(view({ roles: { status: "error", error: new ApiError(500, "X", "roles failed") } })).toContain("roles failed");
    expect(view({ roles: { status: "success", data: { catalogVersion: "1.0.0", roles: [] } } })).toContain("No roles are configured");
  });

  it("explains a missing analysis instead of showing a score", () => {
    const run: GapRunState = { status: "error", error: new ApiError(404, "NO_ANALYSIS", "none") };
    const html = view({ selectedRoleId: "ai-engineer", run });

    expect(html).toContain("Not yet analyzed");
    expect(html).not.toContain("/100");
  });

  it("reports other failures, including network and session errors", () => {
    const network = view({ selectedRoleId: "ai-engineer", run: { status: "error", error: new ApiError(0, "NETWORK_ERROR", "x") } });
    const session = view({ selectedRoleId: "ai-engineer", run: { status: "error", error: new ApiError(401, "UNAUTHORIZED", "x") } });
    const invalid = view({ selectedRoleId: "ai-engineer", run: { status: "error", error: new ApiError(404, "ROLE_NOT_FOUND", "Role not found.") } });

    expect(network).toContain("could not be reached");
    expect(session).toContain("sign in again");
    expect(invalid).toContain("Role not found.");
  });

  it("shows the backend result for the selected run", () => {
    const html = view({ selectedRoleId: "ai-engineer", run: { status: "done", result: resultOf([requirement({})]) } });

    expect(html).toContain("AI Engineer: Role Match");
    expect(html).toContain("61.2");
  });
});

describe("GapResultView", () => {
  it("displays the backend role match without recomputing it", () => {
    // 60*0.6 would be 36 if the client recomputed; the backend value wins.
    const html = render(<GapResultView result={resultOf([requirement({ evidenceScore: 60, gap: 0, deficit: 0, criticalGap: false })], 99.9)} />);

    expect(html).toContain("99.9");
  });

  it("renders signed gaps and non-negative deficits", () => {
    const html = render(
      <GapResultView
        result={resultOf([
          requirement({}),
          requirement({ skillId: "docker", skillName: "Docker", evidenceScore: 70, minimumScore: 40, gap: 30, deficit: 0, criticalGap: false }),
        ])}
      />,
    );

    expect(html).toContain("−18.0");
    expect(html).toContain("+30.0");
    expect(html).toMatch(/Deficit<\/dt><dd class="tabular-nums">18\.0/);
  });

  it("shows a critical gap with its values and a text status", () => {
    const html = render(<GapResultView result={resultOf([requirement({})])} />);

    expect(html).toContain("Critical gaps (1)");
    expect(html).toContain("Status: Critical Gap");
    expect(html).toContain("Minimum Required");
    expect(html).toContain("is 18.0 below the configured minimum of 60.0");
  });

  it("does not label a skill exactly at its minimum as a critical gap", () => {
    const html = render(
      <GapResultView result={resultOf([requirement({ evidenceScore: 60, gap: 0, deficit: 0, criticalGap: false })], 60)} />,
    );

    expect(html).toContain("Critical gaps (0)");
    expect(html).toContain("Threshold met");
    expect(html).not.toContain("Status: Critical Gap");
    expect(html).toContain("All configured minimum evidence thresholds are met for this role.");
  });

  it("keeps critical gaps visible when the overall match is high", () => {
    const html = render(<GapResultView result={resultOf([requirement({})], 97)} />);

    expect(html).toContain("97.0");
    expect(html).toContain("Status: Critical Gap");
    expect(html).not.toContain("All configured minimum evidence thresholds are met");
  });

  it("does not claim a missing skill has been disproved", () => {
    const html = render(
      <GapResultView
        result={resultOf([requirement({ evidenceScore: 0, evidenceAvailable: false, gap: -60, deficit: 60 })], 0)}
      />,
    );

    expect(html).toContain("No evidence available");
    expect(html).toContain("does not show you lack the skill");
  });

  it("lists every requirement with the full column set and no colour-only signalling", () => {
    const html = render(
      <GapResultView
        result={resultOf([
          requirement({}),
          requirement({ skillId: "docker", skillName: "Docker", evidenceScore: 70, minimumScore: 40, weight: 0.4, gap: 30, deficit: 0, criticalGap: false }),
        ])}
      />,
    );

    for (const column of ["Skill", "Evidence Score", "Minimum", "Gap", "Deficit", "Weight", "Critical Gap"]) {
      expect(html).toContain(`>${column}</th>`);
    }
    expect(html).toContain("Docker");
    expect(html).toContain("40%");
    expect(html).toContain("Critical Gap</td>");
    expect(html).toContain("Threshold met");
  });

  it("avoids readiness claims and the wrong terminology", () => {
    const html = render(<GapResultView result={resultOf([requirement({})])} />).toLowerCase();

    expect(html).toContain("not a hiring assessment");
    expect(html).not.toContain("job-ready");
    expect(html).not.toContain("expertise score");
    expect(html).not.toContain("ai readiness");
  });
});
