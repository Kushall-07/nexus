import { readFileSync } from "node:fs";
import { z } from "zod";
import { EXPERIENCE_LEVELS } from "../types.js";

// config/job-matching.json is the versioned configuration of the Phase 11
// job matcher. It is independent of config/scoring.json and config/roles.json,
// which stay frozen.
const CONFIG_PATH = new URL("../../../../../config/job-matching.json", import.meta.url);

const aliasMap = z.record(z.string(), z.array(z.string().min(1)));

const schema = z
  .object({
    matchingVersion: z.string().min(1),
    weights: z
      .object({
        requiredSkills: z.number().min(0),
        githubProjects: z.number().min(0),
        resume: z.number().min(0),
        preferences: z.number().min(0),
        experienceEligibility: z.number().min(0),
      })
      .strict(),
    githubSupportMinScore: z.number().min(0).max(100),
    resumeOnlySkillCredit: z.number().min(0).max(1),
    minimumAvailableWeight: z.number().min(0).max(1),
    labels: z.object({ strong: z.number(), potential: z.number() }).strict(),
    experienceLevels: z.array(z.enum(EXPERIENCE_LEVELS)).length(EXPERIENCE_LEVELS.length),
    blockerLevelGap: z.number().int().min(1),
    skillAliases: aliasMap,
    tagOnlyAliases: aliasMap,
    prerequisites: aliasMap,
    directionAliases: aliasMap,
    directionKeywords: aliasMap,
  })
  .strict()
  .superRefine((value, ctx) => {
    const sum = Object.values(value.weights).reduce((total, weight) => total + weight, 0);
    if (Math.abs(sum - 1) > 1e-9) {
      ctx.addIssue({ code: "custom", path: ["weights"], message: "weights must sum to 1." });
    }
    if (value.labels.strong <= value.labels.potential) {
      ctx.addIssue({ code: "custom", path: ["labels"], message: "strong threshold must exceed potential." });
    }
  });

export type MatchingConfig = z.infer<typeof schema>;

let cached: MatchingConfig | null = null;

export function loadMatchingConfig(): MatchingConfig {
  if (!cached) {
    cached = schema.parse(JSON.parse(readFileSync(CONFIG_PATH, "utf-8")));
  }
  return cached;
}

export function resetMatchingConfigCache(): void {
  cached = null;
}
