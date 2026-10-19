import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../../api/client";
import type { SkillDetail, SkillEvidenceResponse, SkillOverview } from "../../api/types";
import { SkillDetailView } from "./SkillDetailView";
import { SkillOverviewView } from "./SkillOverviewView";

const noop = () => undefined;
const render = (node: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

const analysis = {
  analysisId: "a1",
  scoringVersion: "1.0.0",
  createdAt: "2026-03-01T00:00:00.000Z",
  repositoryCount: 3,
  evidenceCount: 5,
};

const overview: SkillOverview = {
  analysis,
  categories: [
    {
      id: "frontend",
      displayName: "Frontend",
      skills: [
        { id: "react", displayName: "React", categoryId: "frontend", score: 36.5, status: "scored", repositoryCount: 2 },
        { id: "nextjs", displayName: "Next.js", categoryId: "frontend", score: null, status: "no-evidence", repositoryCount: 0 },
      ],
    },
    {
      id: "devops",
      displayName: "DevOps",
      skills: [{ id: "docker", displayName: "Docker", categoryId: "devops", score: null, status: "no-evidence", repositoryCount: 0 }],
    },
  ],
};

describe("SkillOverviewView", () => {
  it("renders categories, skills, backend scores and detail links", () => {
    const html = render(<SkillOverviewView state={{ status: "success", data: overview }} onRetry={noop} />);

    expect(html).toContain("Frontend");
    expect(html).toContain("React");
    expect(html).toContain("36.5/100");
    expect(html).toContain('href="/skills/react"');
    expect(html).toContain("2 contributing repositories");
  });

  it("labels skills without evidence instead of showing a zero score", () => {
    const html = render(<SkillOverviewView state={{ status: "success", data: overview }} onRetry={noop} />);

    expect(html).toContain("No evidence available");
    expect(html).not.toContain("0.0/100");
    expect(html).not.toContain("0/100");
    expect(html).toContain("No evidence available for any skill in this category.");
  });

  it("shows Not yet analyzed when no analysis exists", () => {
    const empty: SkillOverview = {
      analysis: null,
      categories: [{ id: "devops", displayName: "DevOps", skills: [{ id: "docker", displayName: "Docker", categoryId: "devops", score: null, status: "not-analyzed", repositoryCount: 0 }] }],
    };
    const html = render(<SkillOverviewView state={{ status: "success", data: empty }} onRetry={noop} onRunScoring={noop} />);

    expect(html).toContain("Not yet analyzed");
    expect(html).toContain("Score collected evidence");
    expect(html).not.toContain("/100");
  });

  it("renders loading and error states with retry", () => {
    expect(render(<SkillOverviewView state={{ status: "loading" }} onRetry={noop} />)).toContain("Loading your skills");

    const html = render(
      <SkillOverviewView state={{ status: "error", error: new ApiError(500, "INTERNAL_ERROR", "boom") }} onRetry={noop} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("boom");
    expect(html).toContain("Retry");
  });

  it("does not use Expertise wording", () => {
    const html = render(<SkillOverviewView state={{ status: "success", data: overview }} onRetry={noop} />);

    expect(html).toContain("Evidence Score");
    expect(html.toLowerCase()).not.toContain("expertise score");
  });
});

const detail: SkillDetail = {
  skill: { id: "react", displayName: "React", categoryId: "frontend", categoryName: "Frontend" },
  analysis,
  status: "scored",
  score: 36.5,
  contributionWeightSum: 1.2,
  contributions: [
    {
      rank: 1,
      repository: { id: "r1", fullName: "octocat/app", url: "https://github.com/octocat/app" },
      repositorySkillScore: 40,
      baseScore: 80,
      breadthFactor: 0.5,
      meaningfulSignalCount: 1,
      applicableWeightSum: 0.2,
      repositorySubstance: 0.9,
      rankMultiplier: 1,
      contributionWeight: 0.9,
      signals: [
        { signal: "dependency", weight: 0.2, applicable: true, strength: 1, meaningful: true, evidenceCount: 1, evidenceIds: ["e1"] },
        { signal: "documentation", weight: 0.05, applicable: false, strength: 0.5, meaningful: false, evidenceCount: 1, evidenceIds: [] },
      ],
    },
  ],
  excludedRepositories: [
    {
      repository: { id: "r3", fullName: "octocat/old", url: "javascript:alert(1)" },
      repositorySkillScore: 10,
      baseScore: 20,
      breadthFactor: 0.5,
      meaningfulSignalCount: 1,
      applicableWeightSum: 0.2,
      signals: [],
    },
  ],
};

const evidence: SkillEvidenceResponse = {
  skillId: "react",
  evidence: [
    {
      repositoryId: "r1",
      skillId: "react",
      evidenceType: "DEPENDENCY",
      signal: "dependency",
      value: "react",
      normalizedStrength: 1,
      sourcePath: "package.json",
      sourceReference: "dependencies.react",
      explanation: "react is declared in package.json",
      detectedAt: "2026-03-01T00:00:00.000Z",
    },
    {
      repositoryId: "r9",
      skillId: "react",
      evidenceType: "SOURCE_IMPORT",
      signal: "sourceUsage",
      value: 2,
      normalizedStrength: 0.25,
      explanation: "<script>alert(1)</script>",
      detectedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
};

describe("SkillDetailView", () => {
  const view = (overrides: Partial<Parameters<typeof SkillDetailView>[0]> = {}) =>
    render(
      <SkillDetailView
        detail={{ status: "success", data: detail }}
        evidence={{ status: "success", data: evidence }}
        onRetryDetail={noop}
        onRetryEvidence={noop}
        {...overrides}
      />,
    );

  it("shows the score, category, interpretation and back navigation", () => {
    const html = view();

    expect(html).toContain("React");
    expect(html).toContain("Frontend");
    expect(html).toContain("36.5/100");
    expect(html).toContain("not proof of expertise");
    expect(html).toContain('href="/"');
  });

  it("shows the signal breakdown with weights and applicability", () => {
    const html = view();

    expect(html).toContain("Dependencies");
    expect(html).toContain("0.2");
    expect(html).toContain("No (not counted)");
  });

  it("shows repository contribution details and the GitHub link", () => {
    const html = view();

    expect(html).toContain("octocat/app");
    expect(html).toContain('href="https://github.com/octocat/app"');
    expect(html).toContain("Rank 1");
    expect(html).toContain("Contribution weight");
    expect(html).toContain("0.9");
    expect(html).toContain("Rank multiplier");
  });

  it("keeps excluded repositories separate and never links unsafe URLs", () => {
    const html = view();

    expect(html).toContain("Not counted in the score");
    expect(html).toContain("octocat/old");
    expect(html).not.toContain("javascript:");
  });

  it("shows evidence provenance and escapes untrusted text", () => {
    const html = view();

    expect(html).toContain("react is declared in package.json");
    expect(html).toContain("package.json");
    expect(html).toContain("dependencies.react");
    expect(html).toContain("Source path");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Evidence from repositories that did not contribute to the score");
  });

  it("renders the no-evidence state without a score", () => {
    const html = view({
      detail: { status: "success", data: { ...detail, status: "no-evidence", score: null, contributionWeightSum: null, contributions: [], excludedRepositories: [] } },
      evidence: { status: "success", data: { skillId: "react", evidence: [] } },
    });

    expect(html).toContain("No evidence available");
    expect(html).toContain("does not show you lack the skill");
    expect(html).not.toContain("/100");
  });

  it("renders the not-analyzed state", () => {
    const html = view({
      detail: { status: "success", data: { ...detail, status: "not-analyzed", analysis: null, score: null, contributionWeightSum: null, contributions: [], excludedRepositories: [] } },
      evidence: { status: "success", data: { skillId: "react", evidence: [] } },
    });

    expect(html).toContain("Not yet analyzed");
    expect(html).toContain("Evidence score unavailable");
  });

  it("renders loading, error and unknown-skill states", () => {
    expect(view({ detail: { status: "loading" } })).toContain("Loading skill");
    expect(view({ detail: { status: "error", error: new ApiError(0, "NETWORK_ERROR", "x") } })).toContain("could not be reached");
    expect(view({ detail: { status: "error", error: new ApiError(404, "SKILL_NOT_FOUND", "Skill not found.") } })).toContain("Skill not found");
    expect(view({ evidence: { status: "error", error: new ApiError(500, "X", "evidence failed") } })).toContain("evidence failed");
  });
});

describe("no client-side scoring", () => {
  const modules = import.meta.glob("../../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

  it("contains none of the scoring or role-match algorithm", () => {
    const code = Object.entries(modules)
      .filter(([path]) => !path.includes(".test."))
      .map(([, source]) => source as string)
      .join("\n");

    expect(code.length).toBeGreaterThan(1000);
    for (const forbidden of ["rankDecay", "Math.pow", "breadthFactors", "Math.log", "reduce("]) {
      expect(code).not.toContain(forbidden);
    }
  });
});
