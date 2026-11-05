import type { RoleDefinition } from "@nexus/domain";
import { loadMatchingConfig } from "../matching/matching-config.js";
import type { MatchProfile } from "../matching/job-matcher.js";
import type { NormalizedJob, TaskStatus } from "../types.js";
import { templateFor, type TaskTemplate } from "./task-templates.js";

// Phase 12 career-transition analysis. Separate from the frozen role gap
// engine: the role catalog is read as a versioned baseline, job listings add
// employer-demand signal, and the user's current evidence is only read.

export type TransitionSkillStatus = "demonstrated" | "partial" | "resume-claimed" | "missing" | "unverified";

export interface TransitionGap {
  skillId: string;
  skillName: string;
  status: TransitionSkillStatus;
  githubScore: number | null;
  minimumScore: number | null;
  baselineWeight: number | null; // from the role catalog; null when only seen in listings
  demandCount: number;
  priority: number;
  prerequisites: Array<{ skillId: string; skillName: string; status: TransitionSkillStatus }>;
  whyItMatters: string;
  task: TaskTemplate;
  taskStatus: TaskStatus | null;
}

export interface TransitionAnalysis {
  direction: { id: string; displayName: string };
  baseline: { source: "role-catalog"; version: string };
  demand: {
    source: "live" | "demo" | "none";
    sampleSize: number;
    note: string;
  };
  gaps: TransitionGap[];
  alreadyDemonstrated: Array<{ skillId: string; skillName: string; githubScore: number }>;
  nextAction: string;
  caveats: string[];
}

export interface TransitionInput {
  role: RoleDefinition;
  roleCatalogVersion: string;
  skillName: (skillId: string) => string;
  profile: MatchProfile;
  demandJobs: NormalizedJob[];
  demandSource: "live" | "demo" | "none";
  taskStatuses: Record<string, { status: TaskStatus }>;
}

function statusOf(skillId: string, minimum: number | null, profile: MatchProfile): { status: TransitionSkillStatus; score: number | null } {
  const config = loadMatchingConfig();
  const score = profile.githubScores?.get(skillId) ?? null;
  const threshold = minimum ?? config.githubSupportMinScore;

  if (score !== null && score >= threshold) return { status: "demonstrated", score };
  if (profile.resume?.skills.has(skillId)) return { status: "resume-claimed", score };
  if (score !== null && score >= config.githubSupportMinScore) return { status: "partial", score };
  // Without any GitHub analysis we cannot tell "missing" from "not yet measured".
  return { status: profile.githubScores === null ? "unverified" : "missing", score };
}

export function analyzeTransition(input: TransitionInput): TransitionAnalysis {
  const { role, profile } = input;
  const config = loadMatchingConfig();
  const sampleSize = input.demandJobs.length;

  const demandCounts = new Map<string, number>();
  for (const job of input.demandJobs) {
    for (const skill of new Set(job.requiredSkills)) demandCounts.set(skill, (demandCounts.get(skill) ?? 0) + 1);
  }

  const maxWeight = Math.max(...role.requirements.map((req) => req.weight), 0.0001);
  const candidates = new Map<string, { weight: number | null; minimum: number | null }>();
  for (const req of role.requirements) candidates.set(req.skillId, { weight: req.weight, minimum: req.minimumScore });

  // Skills that recur in several listings but are absent from the baseline. Requires a real
  // sample (>=3 listings) so a single listing can never dictate the plan.
  if (sampleSize >= 3) {
    for (const [skillId, count] of demandCounts) {
      if (!candidates.has(skillId) && count >= 2 && count / sampleSize >= 0.3 && skillId in config.skillAliases) {
        candidates.set(skillId, { weight: null, minimum: null });
      }
    }
  }

  const gaps: TransitionGap[] = [];
  const demonstrated: TransitionAnalysis["alreadyDemonstrated"] = [];

  for (const [skillId, { weight, minimum }] of candidates) {
    const { status, score } = statusOf(skillId, minimum, profile);
    const name = input.skillName(skillId);

    if (status === "demonstrated") {
      demonstrated.push({ skillId, skillName: name, githubScore: score ?? 0 });
      continue;
    }

    const demandCount = demandCounts.get(skillId) ?? 0;
    const importance = weight === null ? 0.5 : weight / maxWeight;
    const demand = sampleSize > 0 ? demandCount / sampleSize : 0;
    const target = minimum ?? config.githubSupportMinScore;
    let need = score === null ? 1 : Math.max(0.15, 1 - score / Math.max(target, 1));
    if (status === "resume-claimed") need = Math.min(need, 0.7); // claimed but unverified: still needs proof

    const prerequisites = (config.prerequisites[skillId] ?? []).map((pre) => ({
      skillId: pre,
      skillName: input.skillName(pre),
      status: statusOf(pre, null, profile).status,
    }));

    const reasons: string[] = [];
    if (weight !== null) reasons.push(`${Math.round(weight * 100)}% of the ${role.displayName} benchmark`);
    if (sampleSize > 0) reasons.push(`required in ${demandCount} of ${sampleSize} sampled listings`);

    gaps.push({
      skillId,
      skillName: name,
      status,
      githubScore: score,
      minimumScore: minimum,
      baselineWeight: weight,
      demandCount,
      priority: Math.round((0.7 * importance + 0.3 * demand) * need * 100) / 100,
      prerequisites: prerequisites.filter((pre) => pre.status !== "demonstrated"),
      whyItMatters: reasons.length > 0 ? `${reasons.join("; ")}.` : "Seen in the sampled listings.",
      task: templateFor(skillId, name),
      taskStatus: input.taskStatuses[skillId]?.status ?? null,
    });
  }

  gaps.sort((a, b) => b.priority - a.priority || a.skillId.localeCompare(b.skillId));

  // Prerequisites that are themselves gaps are ordered ahead of what depends on them.
  const ordered: TransitionGap[] = [];
  const placed = new Set<string>();
  const byId = new Map(gaps.map((gap) => [gap.skillId, gap]));
  const place = (gap: TransitionGap, trail: Set<string>) => {
    if (placed.has(gap.skillId) || trail.has(gap.skillId)) return;
    trail.add(gap.skillId);
    for (const pre of gap.prerequisites) {
      const dependency = byId.get(pre.skillId);
      if (dependency) place(dependency, trail);
    }
    placed.add(gap.skillId);
    ordered.push(gap);
  };
  gaps.forEach((gap) => place(gap, new Set()));

  const caveats = [
    "A completed task does not by itself verify a skill; re-analyze your GitHub profile or add reviewed resume evidence.",
    "The plan does not predict hiring outcomes.",
  ];
  if (input.demandSource === "demo") caveats.push("Employer-demand figures come from invented demo fixtures, not live market research.");
  if (input.demandSource === "none") caveats.push("No job listings were available, so priorities rely on the role benchmark alone.");
  if (profile.githubScores === null) caveats.push("No GitHub analysis exists yet, so skills are reported as unverified rather than missing.");

  const next = ordered.find((gap) => gap.taskStatus !== "completed" && gap.taskStatus !== "skipped") ?? ordered[0];

  return {
    direction: { id: role.id, displayName: role.displayName },
    baseline: { source: "role-catalog", version: input.roleCatalogVersion },
    demand: {
      source: input.demandSource,
      sampleSize,
      note:
        input.demandSource === "live"
          ? "Listings are employer-demand samples, not a full picture of the occupation."
          : input.demandSource === "demo"
            ? "Demo fixtures: illustrative only."
            : "No listings sampled.",
    },
    gaps: ordered,
    alreadyDemonstrated: demonstrated,
    nextAction: next
      ? `Start with ${next.skillName}: ${next.task.milestone}`
      : "Your current evidence meets the benchmark for this direction. Keep your projects up to date.",
    caveats,
  };
}
