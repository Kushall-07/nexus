import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SIGNAL_TYPES,
  ScoringConfigError,
  ScoringInputError,
  aggregateSkill,
  breadthFactor,
  computeRepositorySubstance,
  parseSkillTaxonomy,
  parseScoringConfig,
  rankMultiplier,
  scoreRepositorySkill,
  scoreSkills,
  type ScoringConfig,
  type ScoringEvidence,
  type SignalType,
} from "../src/index.js";

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../config/${name}`, import.meta.url), "utf-8"));

const taxonomy = parseSkillTaxonomy(readJson("skills.json"));
const skillIds = taxonomy.skills.map((skill) => skill.id);
const rawConfig = readJson("scoring.json") as Record<string, any>;
const config: ScoringConfig = parseScoringConfig(rawConfig, skillIds);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// "react" applies to all signals except projectStructure; "unit-testing" applies to testing + activity.
function ev(
  repositoryId: string,
  skillId: string,
  signal: SignalType,
  normalizedStrength: number,
  evidenceId?: string,
): ScoringEvidence {
  return { repositoryId, skillId, signal, normalizedStrength, ...(evidenceId ? { evidenceId } : {}) };
}

const obs = (repositoryId: string, sourceFileCount = 50, relevantStructureSignalCount = 5) => ({
  repositoryId,
  sourceFileCount,
  relevantStructureSignalCount,
});

// Full-strength evidence on `count` of react's applicable signals.
const REACT_SIGNALS: SignalType[] = ["dependency", "framework", "sourceUsage", "testing", "documentation", "activity"];
const reactEvidence = (repositoryId: string, count: number, strength = 1) =>
  REACT_SIGNALS.slice(0, count).map((signal) => ev(repositoryId, "react", signal, strength));

describe("scoring configuration", () => {
  it("loads the shipped configuration against the taxonomy", () => {
    expect(config.scoringVersion).toBe("1.0.0");
    expect(config.signalWeights).toEqual({
      dependency: 0.2, framework: 0.2, sourceUsage: 0.25, projectStructure: 0.1,
      testing: 0.1, documentation: 0.05, activity: 0.1,
    });
    expect(config.aggregation).toEqual({ topRepositories: 5, rankDecay: 0.6 });
  });

  it("has signal weights that sum to 1", () => {
    const sum = SIGNAL_TYPES.reduce((total, signal) => total + config.signalWeights[signal], 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("rejects weights that do not sum to 1 instead of normalizing them", () => {
    const bad = clone(rawConfig);
    bad.signalWeights.activity = 0.2;
    expect(() => parseScoringConfig(bad, skillIds)).toThrow(ScoringConfigError);
  });

  it.each([
    ["missing weight", (c: any) => delete c.signalWeights.testing],
    ["unknown signal", (c: any) => { c.signalWeights.vibes = 0; }],
    ["negative weight", (c: any) => { c.signalWeights.testing = -0.1; c.signalWeights.activity = 0.3; }],
    ["non-numeric weight", (c: any) => { c.signalWeights.testing = "0.1"; }],
    ["unknown skill in applicability", (c: any) => { c.applicability.cobol = ["activity"]; }],
    ["unknown signal in applicability", (c: any) => { c.applicability.react = ["vibes"]; }],
    ["skill missing from applicability", (c: any) => delete c.applicability.react],
    ["duplicate applicability signal", (c: any) => { c.applicability.react = ["activity", "activity"]; }],
    ["non-positive top-N", (c: any) => { c.aggregation.topRepositories = 0; }],
    ["invalid rank decay", (c: any) => { c.aggregation.rankDecay = 1.5; }],
    ["descending breadth tiers", (c: any) => { c.breadthFactors.tiers[1].factor = 0.4; }],
    ["breadth tier gap at start", (c: any) => { c.breadthFactors.tiers[0].minMeaningfulSignals = 2; }],
    ["invalid threshold", (c: any) => { c.meaningfulSignalThreshold = 0; }],
    ["substance weights not summing to 1", (c: any) => { c.repositorySubstance.sourceDepthWeight = 0.9; }],
    ["substance range not ending at 1", (c: any) => { c.repositorySubstance.span = 0.5; }],
  ])("rejects malformed configuration: %s", (_label, mutate) => {
    const bad = clone(rawConfig);
    mutate(bad);
    expect(() => parseScoringConfig(bad, skillIds)).toThrow(ScoringConfigError);
  });

  it("rejects non-object configuration", () => {
    expect(() => parseScoringConfig(null, skillIds)).toThrow(ScoringConfigError);
  });
});

describe("repository skill score", () => {
  it("returns 0 when there is no evidence", () => {
    const result = scoreRepositorySkill("r1", "react", [], config);
    expect(result.baseScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it("returns BaseScore 0 when a skill has no applicable signals", () => {
    const noSignals = clone(config);
    noSignals.applicability.react = [];
    const result = scoreRepositorySkill("r1", "react", [ev("r1", "react", "dependency", 1)], noSignals);
    expect(result.applicableWeightSum).toBe(0);
    expect(result.baseScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it("does not let non-applicable signals touch the denominator or the numerator", () => {
    // unit-testing applies to testing (0.10) and activity (0.10) only.
    const result = scoreRepositorySkill(
      "r1", "unit-testing",
      [ev("r1", "unit-testing", "testing", 1), ev("r1", "unit-testing", "dependency", 1)],
      config,
    );
    expect(result.applicableWeightSum).toBeCloseTo(0.2, 12);
    expect(result.baseScore).toBeCloseTo((100 * 0.1) / 0.2, 10);
    expect(result.signals.find((s) => s.signal === "dependency")).toMatchObject({
      applicable: false, meaningful: false, strength: 1,
    });
    expect(result.meaningfulSignalCount).toBe(1);
  });

  it("is not penalised for missing non-applicable evidence", () => {
    // Full evidence on every applicable signal gives BaseScore 100.
    const result = scoreRepositorySkill(
      "r1", "unit-testing",
      [ev("r1", "unit-testing", "testing", 1), ev("r1", "unit-testing", "activity", 1)],
      config,
    );
    expect(result.baseScore).toBeCloseTo(100, 10);
  });

  it.each([
    [1, 0.5],
    [2, 0.75],
    [3, 1],
    [4, 1],
    [6, 1],
  ])("applies BreadthFactor for %i meaningful signals", (count, factor) => {
    const result = scoreRepositorySkill("r1", "react", reactEvidence("r1", count), config);
    expect(result.meaningfulSignalCount).toBe(count);
    expect(result.breadthFactor).toBe(factor);
    expect(result.score).toBeCloseTo(result.baseScore * factor, 10);
  });

  it("caps a single meaningful signal at 50 and two at 75", () => {
    const one = scoreRepositorySkill("r1", "unit-testing", [ev("r1", "unit-testing", "testing", 1)], config);
    // testing 1.0 of weights (0.1 + 0.1): base 50, one signal -> 25.
    expect(one.score).toBeLessThanOrEqual(50);
    const single = clone(config);
    single.applicability.python = ["sourceUsage"];
    const capped = scoreRepositorySkill("r1", "python", [ev("r1", "python", "sourceUsage", 1)], single);
    expect(capped.baseScore).toBe(100);
    expect(capped.score).toBe(50);
    const two = scoreRepositorySkill(
      "r1", "unit-testing",
      [ev("r1", "unit-testing", "testing", 1), ev("r1", "unit-testing", "activity", 1)],
      config,
    );
    expect(two.score).toBe(75);
  });

  it("treats strength exactly 0.25 as meaningful and slightly below as not", () => {
    const at = scoreRepositorySkill("r1", "python", [ev("r1", "python", "sourceUsage", 0.25)], config);
    const below = scoreRepositorySkill("r1", "python", [ev("r1", "python", "sourceUsage", 0.2499999)], config);
    expect(at.meaningfulSignalCount).toBe(1);
    expect(below.meaningfulSignalCount).toBe(0);
    expect(below.breadthFactor).toBe(config.breadthFactors.noMeaningfulSignal);
  });

  it("scores all-zero strengths as 0", () => {
    const result = scoreRepositorySkill("r1", "react", reactEvidence("r1", 6, 0), config);
    expect(result.baseScore).toBe(0);
    expect(result.score).toBe(0);
    expect(result.meaningfulSignalCount).toBe(0);
  });

  it("reaches exactly 100 with full evidence on all applicable signals", () => {
    const result = scoreRepositorySkill("r1", "react", reactEvidence("r1", 6), config);
    expect(result.score).toBeCloseTo(100, 10);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("reduces duplicate evidence on one signal to its maximum (no double counting)", () => {
    const duplicated = scoreRepositorySkill(
      "r1", "react",
      [ev("r1", "react", "dependency", 0.4, "a"), ev("r1", "react", "dependency", 0.9, "b"), ev("r1", "react", "dependency", 0.9, "c")],
      config,
    );
    const single = scoreRepositorySkill("r1", "react", [ev("r1", "react", "dependency", 0.9)], config);
    expect(duplicated.score).toBe(single.score);
    const signal = duplicated.signals.find((s) => s.signal === "dependency")!;
    expect(signal.strength).toBe(0.9);
    expect(signal.evidenceCount).toBe(3);
    expect(signal.evidenceIds).toEqual(["a", "b", "c"]);
  });

  it("does not round intermediate values", () => {
    const result = scoreRepositorySkill(
      "r1", "react",
      [ev("r1", "react", "dependency", 1 / 3), ev("r1", "react", "framework", 2 / 3), ev("r1", "react", "sourceUsage", 0.333333333)],
      config,
    );
    const expectedBase = (100 * (0.2 / 3 + (0.2 * 2) / 3 + 0.25 * 0.333333333)) / (0.2 + 0.2 + 0.25 + 0.1 + 0.05 + 0.1);
    expect(result.baseScore).toBeCloseTo(expectedBase, 12);
    expect(result.score).toBe(result.baseScore * 1);
    expect(Number.isInteger(result.score * 100)).toBe(false);
  });

  it("exposes the full signal breakdown in fixed order", () => {
    const result = scoreRepositorySkill("r1", "react", [], config);
    expect(result.signals.map((s) => s.signal)).toEqual([...SIGNAL_TYPES]);
  });
});

describe("breadth factor and rank multiplier", () => {
  it("maps counts to tiers", () => {
    expect([0, 1, 2, 3, 4, 7].map((count) => breadthFactor(count, config))).toEqual([0.5, 0.5, 0.75, 1, 1, 1]);
  });

  it("computes 0.60^(i-1)", () => {
    expect([1, 2, 3, 4, 5].map((rank) => rankMultiplier(rank, config))).toEqual([
      1, 0.6, Math.pow(0.6, 2), Math.pow(0.6, 3), Math.pow(0.6, 4),
    ]);
    expect(rankMultiplier(4, config)).toBeCloseTo(0.216, 12);
    expect(rankMultiplier(5, config)).toBeCloseTo(0.1296, 12);
  });
});

describe("repository substance", () => {
  it("is 0.25 at the minimum", () => {
    const result = computeRepositorySubstance(obs("r1", 0, 0), config);
    expect(result.substance).toBe(0.25);
    expect(result.sourceDepth).toBe(0);
    expect(result.structureDepth).toBe(0);
  });

  it("is 1.0 at the maximum and saturates beyond the reference values", () => {
    expect(computeRepositorySubstance(obs("r1", 50, 5), config).substance).toBeCloseTo(1, 12);
    expect(computeRepositorySubstance(obs("r1", 5000, 99), config).substance).toBeCloseTo(1, 12);
  });

  it("applies the exact frozen formula", () => {
    const result = computeRepositorySubstance(obs("r1", 10, 2), config);
    const sourceDepth = Math.log(11) / Math.log(51);
    const structureDepth = 2 / 5;
    const raw = 0.7 * sourceDepth + 0.3 * structureDepth;
    expect(result.sourceDepth).toBe(sourceDepth);
    expect(result.structureDepth).toBe(structureDepth);
    expect(result.substanceRaw).toBe(raw);
    expect(result.substance).toBe(0.25 + 0.75 * raw);
  });

  it("stays within [0.25, 1]", () => {
    for (const files of [0, 1, 7, 49, 50, 51, 1e6]) {
      for (const structure of [0, 1, 3, 5, 12]) {
        const { substance } = computeRepositorySubstance(obs("r", files, structure), config);
        expect(substance).toBeGreaterThanOrEqual(0.25);
        expect(substance).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rejects invalid observations", () => {
    expect(() => computeRepositorySubstance(obs("r1", -1, 0), config)).toThrow(ScoringInputError);
    expect(() => computeRepositorySubstance(obs("r1", 1, Number.NaN), config)).toThrow(ScoringInputError);
  });
});

describe("cross-repository aggregation", () => {
  // Repositories with `n` meaningful react signals get progressively lower scores.
  function repos(ids: string[], count = 3): { evidence: ScoringEvidence[]; repositories: ReturnType<typeof obs>[] } {
    return {
      evidence: ids.flatMap((id, index) => reactEvidence(id, count, 1 - index * 0.1)),
      repositories: ids.map((id) => obs(id)),
    };
  }

  it("returns the repository score when only one repository has evidence", () => {
    const result = scoreSkills({ evidence: reactEvidence("r1", 2), repositories: [obs("r1", 3, 0)] }, config);
    expect(result.skillScores).toHaveLength(1);
    expect(result.skillScores[0]!.score).toBe(result.repositorySkillScores[0]!.score);
    expect(result.skillScores[0]!.contributions).toHaveLength(1);
  });

  it("combines two repositories with the exact weighted formula", () => {
    const input = {
      evidence: [...reactEvidence("a", 3), ...reactEvidence("b", 2)],
      repositories: [obs("a", 50, 5), obs("b", 0, 0)],
    };
    const result = scoreSkills(input, config);
    const scoreA = result.repositorySkillScores.find((s) => s.repositoryId === "a")!.score;
    const scoreB = result.repositorySkillScores.find((s) => s.repositoryId === "b")!.score;
    expect(scoreA).toBeGreaterThan(scoreB);

    const wA = 1 * 1;
    const wB = 0.25 * 0.6;
    expect(result.skillScores[0]!.score).toBeCloseTo((scoreA * wA + scoreB * wB) / (wA + wB), 12);
    expect(result.skillScores[0]!.contributions.map((c) => [c.repositoryId, c.rank])).toEqual([["a", 1], ["b", 2]]);
  });

  it("uses only the top five repositories", () => {
    const ids = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"];
    const result = scoreSkills(repos(ids), config);
    const skill = result.skillScores[0]!;
    expect(skill.contributions).toHaveLength(5);
    expect(skill.contributions.map((c) => c.repositoryId)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(skill.excludedByRank.map((e) => e.repositoryId)).toEqual(["r6", "r7"]);
    expect(skill.contributions.map((c) => c.rankMultiplier)).toEqual([1, 0.6, 0.6 ** 2, 0.6 ** 3, 0.6 ** 4]);
  });

  it("handles fewer than five and exactly five repositories", () => {
    expect(scoreSkills(repos(["r1", "r2", "r3"]), config).skillScores[0]!.contributions).toHaveLength(3);
    const five = scoreSkills(repos(["r1", "r2", "r3", "r4", "r5"]), config).skillScores[0]!;
    expect(five.contributions).toHaveLength(5);
    expect(five.excludedByRank).toEqual([]);
  });

  it("makes substance affect contribution weight but not ranking", () => {
    const input = {
      evidence: [...reactEvidence("hi", 3), ...reactEvidence("lo", 3, 0.9)],
      // "lo" has far more substance, yet "hi" still ranks first by score.
      repositories: [obs("hi", 0, 0), obs("lo", 50, 5)],
    };
    const skill = scoreSkills(input, config).skillScores[0]!;
    expect(skill.contributions.map((c) => c.repositoryId)).toEqual(["hi", "lo"]);
    expect(skill.contributions[0]!.contributionWeight).toBe(0.25 * 1);
    expect(skill.contributions[1]!.contributionWeight).toBeCloseTo(1 * 0.6, 12);
    expect(skill.contributions[0]!.contributionWeight).toBeLessThan(skill.contributions[1]!.contributionWeight);
  });

  it("ranks by repository skill score before applying rank multipliers", () => {
    // Without multipliers the lower-substance repo would not matter for order.
    const input = {
      evidence: [...reactEvidence("low", 1), ...reactEvidence("high", 6)],
      repositories: [obs("low", 50, 5), obs("high", 0, 0)],
    };
    const skill = scoreSkills(input, config).skillScores[0]!;
    expect(skill.contributions[0]).toMatchObject({ repositoryId: "high", rank: 1, rankMultiplier: 1 });
    expect(skill.contributions[1]).toMatchObject({ repositoryId: "low", rank: 2, rankMultiplier: 0.6 });
  });

  it("breaks score ties by repository id", () => {
    const input = {
      evidence: [...reactEvidence("b", 3), ...reactEvidence("a", 3)],
      repositories: [obs("b"), obs("a")],
    };
    const skill = scoreSkills(input, config).skillScores[0]!;
    expect(skill.contributions.map((c) => c.repositoryId)).toEqual(["a", "b"]);
  });

  it("excludes zero-score repositories", () => {
    const input = {
      evidence: [...reactEvidence("a", 3), ...reactEvidence("zero", 6, 0)],
      repositories: [obs("a"), obs("zero")],
    };
    const skill = scoreSkills(input, config).skillScores[0]!;
    expect(skill.contributions.map((c) => c.repositoryId)).toEqual(["a"]);
    expect(skill.excludedByRank).toEqual([]);
  });

  it("emits no final score for a skill whose repositories all score zero", () => {
    const result = scoreSkills({ evidence: reactEvidence("a", 6, 0), repositories: [obs("a")] }, config);
    expect(result.skillScores).toEqual([]);
    expect(result.repositorySkillScores).toHaveLength(1);
  });

  it("returns an empty result for empty evidence", () => {
    const result = scoreSkills({ evidence: [], repositories: [obs("a")] }, config);
    expect(result.skillScores).toEqual([]);
    expect(result.repositorySkillScores).toEqual([]);
    expect(result.scoringVersion).toBe("1.0.0");
  });

  it("aggregateSkill returns null with no positive scores", () => {
    expect(aggregateSkill("react", [], new Map(), config)).toBeNull();
  });

  it("scores several skills independently", () => {
    const evidence = [
      ...reactEvidence("a", 3),
      ev("a", "python", "sourceUsage", 1),
      ev("a", "python", "activity", 1),
    ];
    const result = scoreSkills({ evidence, repositories: [obs("a")] }, config);
    expect(result.skillScores.map((s) => s.skillId)).toEqual(["python", "react"]);
  });

  it("keeps every score within [0, 100]", () => {
    const evidence = ["a", "b", "c"].flatMap((id) => reactEvidence(id, 6, 1));
    const result = scoreSkills({ evidence, repositories: ["a", "b", "c"].map((id) => obs(id)) }, config);
    for (const score of [...result.skillScores.map((s) => s.score), ...result.repositorySkillScores.map((s) => s.score)]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("determinism and input validation", () => {
  const evidence = [
    ...reactEvidence("a", 4, 0.8), ...reactEvidence("b", 2, 0.5), ...reactEvidence("c", 5, 0.3),
    ev("a", "python", "sourceUsage", 0.6), ev("b", "python", "activity", 0.4),
  ];
  const repositories = [obs("a", 12, 2), obs("b", 40, 4), obs("c", 3, 0)];

  it("is independent of input order", () => {
    const baseline = scoreSkills({ evidence, repositories }, config);
    const shuffled = scoreSkills(
      { evidence: [...evidence].reverse(), repositories: [...repositories].reverse() },
      config,
    );
    expect(shuffled).toEqual(baseline);
  });

  it("is identical across repeated execution", () => {
    const first = JSON.stringify(scoreSkills({ evidence, repositories }, config));
    for (let i = 0; i < 5; i++) {
      expect(JSON.stringify(scoreSkills({ evidence, repositories }, config))).toBe(first);
    }
  });

  it("ignores evidence timestamps and other non-scoring fields", () => {
    const decorated = evidence.map((item, index) => ({
      ...item, detectedAt: new Date(index * 1e9), userId: `u${index}`, explanation: "x",
    }));
    expect(scoreSkills({ evidence: decorated, repositories }, config)).toEqual(
      scoreSkills({ evidence, repositories }, config),
    );
  });

  it("rejects invalid evidence strength", () => {
    for (const bad of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        scoreSkills({ evidence: [ev("a", "react", "dependency", bad)], repositories: [obs("a")] }, config),
      ).toThrow(ScoringInputError);
    }
  });

  it("rejects an unknown skill, an unknown signal and evidence for an unknown repository", () => {
    expect(() =>
      scoreSkills({ evidence: [ev("a", "cobol", "dependency", 1)], repositories: [obs("a")] }, config),
    ).toThrow(ScoringInputError);
    expect(() =>
      scoreSkills({ evidence: [ev("a", "react", "vibes" as SignalType, 1)], repositories: [obs("a")] }, config),
    ).toThrow(ScoringInputError);
    expect(() =>
      scoreSkills({ evidence: [ev("ghost", "react", "dependency", 1)], repositories: [obs("a")] }, config),
    ).toThrow(ScoringInputError);
  });

  it("rejects duplicate repository observations", () => {
    expect(() => scoreSkills({ evidence: [], repositories: [obs("a"), obs("a")] }, config)).toThrow(ScoringInputError);
  });

  it("only scores evidence it was given, so repositories outside the input cannot leak in", () => {
    const owned = scoreSkills({ evidence: reactEvidence("mine", 3), repositories: [obs("mine")] }, config);
    expect(owned.repositorySkillScores.every((s) => s.repositoryId === "mine")).toBe(true);
  });
});
