import { describe, expect, it } from "vitest";
import { interpretMessage } from "../../src/career/copilot/intent.js";
import type { MatchProfile } from "../../src/career/matching/job-matcher.js";
import { analyzeTransition } from "../../src/career/transition/transition-analysis.js";
import type { NormalizedJob } from "../../src/career/types.js";

const role = {
  id: "backend-engineer",
  displayName: "Backend Engineer",
  requirements: [
    { skillId: "nodejs", weight: 0.3, minimumScore: 50 },
    { skillId: "postgresql", weight: 0.3, minimumScore: 50 },
    { skillId: "integration-testing", weight: 0.2, minimumScore: 40 },
    { skillId: "docker", weight: 0.2, minimumScore: 40 },
  ],
};

const profile = (overrides: Partial<MatchProfile> = {}): MatchProfile => ({
  githubScores: new Map([["nodejs", 70]]),
  githubProjects: new Map(),
  resume: null,
  preferences: { directions: [], employmentTypes: [], workModes: [], locations: [] },
  ...overrides,
});

const base = {
  role,
  roleCatalogVersion: "1.0.0",
  skillName: (id: string) => id,
  demandJobs: [] as NormalizedJob[],
  demandSource: "none" as const,
  taskStatuses: {},
};

function listing(id: string, skills: string[]): NormalizedJob {
  return {
    id: `demo:${id}`, provider: "demo", providerJobId: id, isDemo: true, title: "t", description: "", requiredSkills: skills,
    preferredSkills: [], qualifications: [], url: "https://example.com", sourceName: "d", retrievedAt: "x", stale: false,
  };
}

describe("transition analysis", () => {
  it("separates demonstrated skills from gaps and distinguishes missing from resume-claimed", () => {
    const result = analyzeTransition({
      ...base,
      profile: profile({ resume: { skills: new Set(["docker"]), experienceTexts: [] } }),
    });
    expect(result.alreadyDemonstrated.map((s) => s.skillId)).toEqual(["nodejs"]);
    const byId = Object.fromEntries(result.gaps.map((gap) => [gap.skillId, gap]));
    expect(byId.docker!.status).toBe("resume-claimed");
    expect(byId.postgresql!.status).toBe("missing");
  });

  it("reports unverified, not missing, when no GitHub analysis exists", () => {
    const result = analyzeTransition({ ...base, profile: profile({ githubScores: null }) });
    expect(result.gaps.every((gap) => gap.status === "unverified")).toBe(true);
    expect(result.caveats.join(" ")).toMatch(/No GitHub analysis/);
  });

  it("orders prerequisites ahead of the skills that depend on them", () => {
    const result = analyzeTransition({ ...base, profile: profile({ githubScores: new Map([["nodejs", 70]]) }) });
    const ids = result.gaps.map((gap) => gap.skillId);
    // integration-testing needs unit-testing, which is not in the baseline, so it stays; postgresql needs sql similarly.
    expect(ids).toContain("integration-testing");
    const gap = result.gaps.find((entry) => entry.skillId === "integration-testing")!;
    expect(gap.prerequisites.map((pre) => pre.skillId)).toEqual(["unit-testing"]);
  });

  it("does not let one listing dictate the plan, but lets recurring demand add skills", () => {
    const single = analyzeTransition({ ...base, profile: profile(), demandJobs: [listing("1", ["go"])], demandSource: "demo" });
    expect(single.gaps.map((g) => g.skillId)).not.toContain("go");

    const many = analyzeTransition({
      ...base,
      profile: profile(),
      demandJobs: [listing("1", ["python"]), listing("2", ["python"]), listing("3", ["python", "go"])],
      demandSource: "demo",
    });
    expect(many.gaps.map((g) => g.skillId)).toContain("python");
    expect(many.gaps.map((g) => g.skillId)).not.toContain("go");
  });

  it("labels fixture-derived demand as non-live and gives every gap a concrete, verifiable task", () => {
    const result = analyzeTransition({ ...base, profile: profile(), demandJobs: [listing("1", ["docker"])], demandSource: "demo" });
    expect(result.caveats.join(" ")).toMatch(/demo fixtures/);
    for (const gap of result.gaps) {
      expect(gap.task.learn.length).toBeGreaterThan(10);
      expect(gap.task.milestone.length).toBeGreaterThan(10);
      expect(gap.task.verification.length).toBeGreaterThan(10);
    }
  });

  it("does not count a completed task as evidence", () => {
    const result = analyzeTransition({ ...base, profile: profile(), taskStatuses: { postgresql: { status: "completed" } } });
    const gap = result.gaps.find((entry) => entry.skillId === "postgresql")!;
    expect(gap.taskStatus).toBe("completed");
    expect(gap.status).toBe("missing");
    expect(result.nextAction).not.toMatch(/PostgreSQL|postgresql/i);
  });

  it("is deterministic", () => {
    const run = () => JSON.stringify(analyzeTransition({ ...base, profile: profile() }));
    expect(run()).toBe(run());
  });
});

describe("deterministic intent recognition", () => {
  it("recognises the documented request types", () => {
    expect(interpretMessage("Find backend internships based on my projects")).toMatchObject({ type: "search_jobs", employmentType: "internship", keywords: "backend" });
    expect(interpretMessage("Show me remote internships")).toMatchObject({ type: "search_jobs", workMode: "remote", employmentType: "internship" });
    expect(interpretMessage("Show me jobs for which I already meet most of the requirements")).toMatchObject({ type: "search_jobs", mostlyQualified: true });
    expect(interpretMessage("What are the most important skills I am missing?")).toMatchObject({ type: "skill_gaps" });
    expect(interpretMessage("Which project should I build to improve my backend profile?")).toMatchObject({ type: "project_suggestion", directionId: "backend-engineer" });
    expect(interpretMessage("I have built a PostgreSQL project. Reanalyze my profile.")).toMatchObject({ type: "refresh_profile" });
    expect(interpretMessage("Replace my resume with this updated version")).toMatchObject({ type: "resume_replace" });
    expect(interpretMessage("Why is this job a good or poor match?")).toMatchObject({ type: "explain_match" });
  });

  it("extracts source and target directions for a transition", () => {
    expect(interpretMessage("I want to transition from AI/ML to full-stack development")).toMatchObject({
      type: "transition",
      fromDirectionId: "ml-engineer",
      directionId: "full-stack-developer",
    });
    expect(interpretMessage("Compare my current profile with a machine-learning engineering path")).toMatchObject({
      type: "transition",
      compare: true,
      directionId: "ml-engineer",
    });
  });

  it("extracts a location and treats deletion as its own intent", () => {
    expect(interpretMessage("Find software jobs in Pune")).toMatchObject({ type: "search_jobs", location: "Pune" });
    expect(interpretMessage("delete my resume")).toMatchObject({ type: "resume_delete" });
  });

  it("returns unknown for unsupported requests instead of guessing", () => {
    expect(interpretMessage("What is the weather like?")).toEqual({ type: "unknown" });
  });
});
