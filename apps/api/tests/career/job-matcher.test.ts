import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchJob, rankMatches, type MatchProfile } from "../../src/career/matching/job-matcher.js";
import { loadMatchingConfig } from "../../src/career/matching/matching-config.js";
import type { NormalizedJob } from "../../src/career/types.js";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: "demo:x",
    provider: "demo",
    providerJobId: "x",
    isDemo: true,
    title: "Backend Engineer",
    description: "",
    requiredSkills: ["nodejs", "postgresql", "docker"],
    preferredSkills: [],
    qualifications: [],
    url: "https://example.com/x",
    sourceName: "Demo",
    retrievedAt: "2026-10-20T00:00:00.000Z",
    stale: false,
    ...overrides,
  };
}

function profile(overrides: Partial<MatchProfile> = {}): MatchProfile {
  return {
    githubScores: new Map([["nodejs", 80], ["postgresql", 60], ["docker", 50]]),
    githubProjects: new Map([["nodejs", [{ fullName: "me/api", url: "https://github.com/me/api" }]]]),
    resume: null,
    preferences: { directions: [], employmentTypes: [], workModes: [], locations: [] },
    ...overrides,
  };
}

describe("matching config", () => {
  it("has weights summing to 1 and is independent of the frozen scoring config", () => {
    const config = loadMatchingConfig();
    expect(Object.values(config.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(config.weights.requiredSkills).toBe(0.35);
  });

  it("leaves the frozen scoring and role configuration untouched", () => {
    const hash = (file: string) => createHash("sha256").update(readFileSync(new URL(`../../../../config/${file}`, import.meta.url))).digest("hex");
    // Any edit to the frozen engine inputs fails this test.
    expect(hash("scoring.json")).toBe(FROZEN.scoring);
    expect(hash("roles.json")).toBe(FROZEN.roles);
  });
});

// SHA-256 of the frozen engine inputs as committed at implementation time.
const FROZEN = {
  scoring: "0054540589d29fa20030a8f2ba22489fd2b922a1c9ff6041b446e6def75c018e",
  roles: "508e177130cc6d7485b42140e29114c044e18ba54cbd50bd39df41cbf9970a21",
};

describe("matchJob scoring components", () => {
  it("scores a fully GitHub-supported job as a strong match with project references", () => {
    const match = matchJob(job(), profile());
    expect(match.label).toBe("strong");
    expect(match.score).toBeGreaterThanOrEqual(70);
    expect(match.skills.every((skill) => skill.status === "github")).toBe(true);
    expect(match.skills.find((skill) => skill.skill === "nodejs")?.projects[0]?.fullName).toBe("me/api");
  });

  it("treats a resume-only skill as partial credit and never as GitHub evidence", () => {
    const resumeOnly = profile({
      githubScores: new Map(),
      resume: { skills: new Set(["nodejs", "postgresql", "docker"]), experienceTexts: [] },
    });
    const match = matchJob(job(), resumeOnly);
    expect(match.skills.every((skill) => skill.status === "resume-only")).toBe(true);
    const required = match.components.find((c) => c.key === "requiredSkills")!;
    expect(required.value).toBeCloseTo(0.6);
    expect(match.components.find((c) => c.key === "githubProjects")!.value).toBe(0);
  });

  it("reports missing skills and a lower score than an exact match", () => {
    const partial = matchJob(job(), profile({ githubScores: new Map([["nodejs", 80]]) }));
    const full = matchJob(job(), profile());
    expect(partial.skills.filter((s) => s.status === "missing")).toHaveLength(2);
    expect(partial.score!).toBeLessThan(full.score!);
  });

  it("does not count a below-threshold GitHub score as support", () => {
    const match = matchJob(job({ requiredSkills: ["docker"] }), profile({ githubScores: new Map([["docker", 10]]) }));
    expect(match.skills[0]?.status).toBe("missing");
  });

  it("returns insufficient evidence when the user has neither GitHub data nor a resume", () => {
    const match = matchJob(job(), profile({ githubScores: null }));
    expect(match.score).toBeNull();
    expect(match.label).toBe("insufficient-evidence");
  });

  it("returns insufficient evidence for a listing without recognisable required skills", () => {
    const match = matchJob(job({ requiredSkills: [] }), profile());
    expect(match.score).toBeNull();
    expect(match.unavailableInformation.join(" ")).toMatch(/required skills/);
  });

  it("deduplicates repeated skills and lets required win over preferred", () => {
    const match = matchJob(job({ requiredSkills: ["nodejs", "NodeJS", "nodejs"], preferredSkills: ["nodejs", "docker"] }), profile());
    expect(match.skills.map((s) => `${s.skill}:${s.requirement}`)).toEqual(["nodejs:required", "docker:preferred"]);
  });

  it("does not penalise or reward missing salary and location data", () => {
    const base = matchJob(job(), profile());
    const withPrefs = matchJob(
      job(),
      profile({ preferences: { directions: [], employmentTypes: [], workModes: [], locations: ["Pune"], minSalary: 100000 } }),
    );
    expect(withPrefs.components.find((c) => c.key === "preferences")!.value).toBeNull();
    expect(withPrefs.preferenceMatches.unknown).toEqual(expect.arrayContaining(["Location", "Salary"]));
    expect(withPrefs.score).toBe(base.score);
  });

  it("counts matching and conflicting preferences", () => {
    const match = matchJob(
      job({ employmentType: "internship", workMode: "remote", location: "Berlin" }),
      profile({ preferences: { directions: [], employmentTypes: ["full-time"], workModes: ["remote"], locations: [], } }),
    );
    expect(match.preferenceMatches.matched).toEqual(["Work mode"]);
    expect(match.preferenceMatches.mismatched).toEqual(["Employment type"]);
  });

  it("surfaces a hard blocker instead of hiding it behind the weighted score", () => {
    const match = matchJob(
      job({ experienceLevel: "senior" }),
      profile({ preferences: { directions: [], employmentTypes: [], workModes: [], locations: [], experienceLevel: "entry" } }),
    );
    expect(match.score).not.toBeNull();
    expect(match.label).toBe("blocked");
    expect(match.hardBlockers[0]).toMatch(/senior/);
  });

  it("flags student-only eligibility as a blocker or an unresolved question", () => {
    const base = job({ studentOnly: true });
    const notStudent = matchJob(base, profile({ preferences: { directions: [], employmentTypes: [], workModes: [], locations: [], isStudent: false } }));
    const unknown = matchJob(base, profile());
    expect(notStudent.label).toBe("blocked");
    expect(unknown.label).not.toBe("blocked");
    expect(unknown.unresolvedEligibility).toHaveLength(1);
  });

  it("uses resume experience relevance for the resume component", () => {
    const withExperience = profile({
      githubScores: null,
      resume: { skills: new Set(["nodejs", "postgresql", "docker"]), experienceTexts: ["Backend intern - built nodejs services"] },
    });
    const without = profile({ githubScores: null, resume: { skills: new Set(["nodejs", "postgresql", "docker"]), experienceTexts: [] } });
    const a = matchJob(job(), withExperience).components.find((c) => c.key === "resume")!.value!;
    const b = matchJob(job(), without).components.find((c) => c.key === "resume")!.value!;
    expect(a).toBeGreaterThan(b);
  });

  it("reports confidence from the number of independent sources", () => {
    expect(matchJob(job(), profile()).confidence).toBe("medium");
    const both = profile({ resume: { skills: new Set(["nodejs"]), experienceTexts: [] } });
    expect(matchJob(job(), both).confidence).toBe("high");
    expect(matchJob(job({ requiredSkills: ["nodejs"] }), profile()).confidence).toBe("low");
  });

  it("is deterministic and ranks stably by tier, score then id", () => {
    const items = [
      job({ id: "demo:b", requiredSkills: ["nodejs"] }),
      job({ id: "demo:a", requiredSkills: ["nodejs"] }),
      job({ id: "demo:c", requiredSkills: ["go", "java"] }),
      job({ id: "demo:d", requiredSkills: [] }),
    ].map((item) => ({ job: item, match: matchJob(item, profile()) }));

    const ranked = rankMatches(items).map((entry) => entry.job.id);
    expect(ranked).toEqual(["demo:a", "demo:b", "demo:c", "demo:d"]);
    expect(rankMatches([...items].reverse()).map((entry) => entry.job.id)).toEqual(ranked);
    expect(matchJob(items[0]!.job, profile())).toEqual(items[0]!.match);
  });

  it("never describes the score as a hiring probability", () => {
    expect(matchJob(job(), profile()).explanation.join(" ")).toMatch(/not a hiring probability/);
  });
});
