import { z } from "zod";

// Phase 7 role catalog and deterministic role-match engine. The data lives in
// config/roles.json; this module defines its shape, strict validation and the
// pure calculation, so it stays free of any filesystem, Express or MongoDB
// dependency. Invalid configuration fails with RoleConfigError and is never
// repaired. The calculation reads no clock and no randomness: identical inputs
// and configuration always produce identical results.

const WEIGHT_SUM_TOLERANCE = 1e-9;

export const REQUIRED_ROLE_COUNT = 5;

export class RoleConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleConfigError";
  }
}

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids must be lowercase kebab-case");

const requirementSchema = z
  .object({
    skillId: idSchema,
    weight: z.number().finite().gt(0).max(1),
    minimumScore: z.number().finite().min(0).max(100),
  })
  .strict();

const roleSchema = z
  .object({
    id: idSchema,
    displayName: z.string().min(1),
    requirements: z.array(requirementSchema).min(1),
  })
  .strict();

export const roleCatalogSchema = z
  .object({
    roleCatalogVersion: z.string().min(1),
    roles: z.array(roleSchema),
  })
  .strict();

export interface RoleRequirement {
  skillId: string;
  weight: number;
  minimumScore: number;
}

export interface RoleDefinition {
  id: string;
  displayName: string;
  requirements: RoleRequirement[];
}

export interface RoleCatalog {
  roleCatalogVersion: string;
  roles: RoleDefinition[];
}

// Validates raw catalog data against the schema and every cross-field
// invariant. `skillIds` is the set of canonical skills in the taxonomy.
export function parseRoleCatalog(raw: unknown, skillIds: readonly string[]): RoleCatalog {
  const parsed = roleCatalogSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new RoleConfigError(`Invalid role configuration: ${details}`);
  }

  const catalog = parsed.data;
  const fail = (message: string): never => {
    throw new RoleConfigError(`Invalid role configuration: ${message}`);
  };

  if (catalog.roles.length !== REQUIRED_ROLE_COUNT) {
    fail(`exactly ${REQUIRED_ROLE_COUNT} roles are required (got ${catalog.roles.length}).`);
  }

  const known = new Set(skillIds);
  const roleIds = new Set<string>();
  const roleNames = new Set<string>();

  for (const role of catalog.roles) {
    if (roleIds.has(role.id)) {
      fail(`duplicate role id "${role.id}".`);
    }
    roleIds.add(role.id);

    if (roleNames.has(role.displayName)) {
      fail(`duplicate role name "${role.displayName}".`);
    }
    roleNames.add(role.displayName);

    const seenSkills = new Set<string>();
    let weightSum = 0;

    for (const requirement of role.requirements) {
      if (!known.has(requirement.skillId)) {
        fail(`role "${role.id}" references unknown skill "${requirement.skillId}".`);
      }
      if (seenSkills.has(requirement.skillId)) {
        fail(`role "${role.id}" requires skill "${requirement.skillId}" more than once.`);
      }
      seenSkills.add(requirement.skillId);
      weightSum += requirement.weight;
    }

    if (Math.abs(weightSum - 1) > WEIGHT_SUM_TOLERANCE) {
      fail(`role "${role.id}" weights must sum to 1 (got ${weightSum}).`);
    }
  }

  return catalog;
}

export function findRole(catalog: RoleCatalog, roleId: string): RoleDefinition | undefined {
  return catalog.roles.find((role) => role.id === roleId);
}

export class RoleMatchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleMatchInputError";
  }
}

export interface RoleRequirementResult {
  skillId: string;
  skillName: string;
  // Deterministic Evidence Score in [0, 100]. 0 when no evidence is available;
  // that is a calculation convention, not a claim that the skill is absent.
  evidenceScore: number;
  // Provenance only: whether the scoring run produced a score for this skill.
  // It never alters the mathematics.
  evidenceAvailable: boolean;
  weight: number;
  minimumScore: number;
  // evidenceScore * weight: this requirement's share of the role match.
  weightedContribution: number;
  // evidenceScore - minimumScore (positive above, zero at, negative below).
  gap: number;
  // max(minimumScore - evidenceScore, 0); never negative.
  deficit: number;
  // evidenceScore < minimumScore (strict: equal to the minimum is not critical).
  criticalGap: boolean;
}

export interface RoleMatchResult {
  roleId: string;
  roleName: string;
  // sum(evidenceScore_i * weight_i), unrounded, within [0, 100].
  roleMatch: number;
  requirements: RoleRequirementResult[];
  // Exactly the requirements flagged criticalGap, in configured order.
  criticalGaps: RoleRequirementResult[];
}

export interface RoleMatchInput {
  role: RoleDefinition;
  // Canonical skill id -> Evidence Score. A skill absent from the map has no
  // evidence.
  scores: ReadonlyMap<string, number>;
  skillNames: ReadonlyMap<string, string>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// RoleMatch = sum(S_i * W_i). Weights are never renormalized over only the
// skills that have evidence. Nothing is rounded.
export function computeRoleMatch({ role, scores, skillNames }: RoleMatchInput): RoleMatchResult {
  let roleMatch = 0;
  const requirements: RoleRequirementResult[] = [];

  for (const requirement of role.requirements) {
    const stored = scores.get(requirement.skillId);

    if (stored !== undefined && (!Number.isFinite(stored) || stored < 0 || stored > 100)) {
      throw new RoleMatchInputError(`Score for skill "${requirement.skillId}" is outside [0, 100].`);
    }

    const evidenceScore = stored ?? 0;
    const weightedContribution = evidenceScore * requirement.weight;
    roleMatch += weightedContribution;

    requirements.push({
      skillId: requirement.skillId,
      skillName: skillNames.get(requirement.skillId) ?? requirement.skillId,
      evidenceScore,
      evidenceAvailable: stored !== undefined,
      weight: requirement.weight,
      minimumScore: requirement.minimumScore,
      weightedContribution,
      gap: evidenceScore - requirement.minimumScore,
      deficit: Math.max(requirement.minimumScore - evidenceScore, 0),
      criticalGap: evidenceScore < requirement.minimumScore,
    });
  }

  return {
    roleId: role.id,
    roleName: role.displayName,
    roleMatch: clamp(roleMatch, 0, 100),
    requirements,
    criticalGaps: requirements.filter((requirement) => requirement.criticalGap),
  };
}
