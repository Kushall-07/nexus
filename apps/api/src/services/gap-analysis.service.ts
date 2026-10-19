import {
  RoleMatchInputError,
  computeRoleMatch,
  findRole,
  type RoleMatchResult,
  type RoleRequirementResult,
} from "@nexus/domain";
import { loadEvidenceConfig } from "../evidence/evidence-config.js";
import { GapAnalysisModel } from "../models/gap-analysis.model.js";
import { loadRoleCatalog, roleCatalogHash } from "../roles/role-config.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { getLatestAnalysis } from "./skill-profile.service.js";

// Phase 7 orchestration. The role-match mathematics lives in @nexus/domain;
// this service only chooses the trusted score source (the user's latest
// persisted Phase 5 analysis), calls the engine and persists the result.

export interface PublicRole {
  id: string;
  displayName: string;
  requirements: Array<{ skillId: string; skillName: string; weight: number; minimumScore: number }>;
}

export interface PublicRoleCatalog {
  catalogVersion: string;
  roles: PublicRole[];
}

export interface GapAnalysisDto extends RoleMatchResult {
  id: string;
  analysisId: string;
  scoringVersion: string;
  roleCatalogVersion: string;
  createdAt: string;
}

function skillNameMap(): Map<string, string> {
  const { taxonomy } = loadEvidenceConfig();

  return new Map(taxonomy.skills.map((skill) => [skill.id, skill.displayName]));
}

function toPublicRole(role: ReturnType<typeof loadRoleCatalog>["roles"][number]): PublicRole {
  const names = skillNameMap();

  return {
    id: role.id,
    displayName: role.displayName,
    requirements: role.requirements.map((requirement) => ({
      skillId: requirement.skillId,
      skillName: names.get(requirement.skillId) ?? requirement.skillId,
      weight: requirement.weight,
      minimumScore: requirement.minimumScore,
    })),
  };
}

export function listRoles(): PublicRoleCatalog {
  const catalog = loadRoleCatalog();

  return { catalogVersion: catalog.roleCatalogVersion, roles: catalog.roles.map(toPublicRole) };
}

export function getRole(roleId: string): PublicRole {
  const role = findRole(loadRoleCatalog(), roleId);

  if (!role) {
    throw new AppError(AuthErrorCode.ROLE_NOT_FOUND, 404, "Role not found.");
  }

  return toPublicRole(role);
}

function isRequirementResult(value: unknown): value is RoleRequirementResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RoleRequirementResult).skillId === "string" &&
    typeof (value as RoleRequirementResult).evidenceScore === "number"
  );
}

function readRoleMatchResult(raw: unknown): RoleMatchResult {
  const candidate = raw as RoleMatchResult | null;

  if (
    !candidate ||
    typeof candidate.roleId !== "string" ||
    typeof candidate.roleName !== "string" ||
    typeof candidate.roleMatch !== "number" ||
    !Array.isArray(candidate.requirements) ||
    !candidate.requirements.every(isRequirementResult) ||
    !Array.isArray(candidate.criticalGaps)
  ) {
    throw new AppError(AuthErrorCode.INVALID_ANALYSIS, 500, "The stored gap analysis is malformed.");
  }

  return candidate;
}

interface StoredGapAnalysis {
  _id: unknown;
  analysisId: unknown;
  scoringVersion: string;
  roleCatalogVersion: string;
  createdAt: Date | string;
  result: unknown;
}

function toDto(document: StoredGapAnalysis): GapAnalysisDto {
  const result = readRoleMatchResult(document.result);

  return {
    id: String(document._id),
    analysisId: String(document.analysisId),
    scoringVersion: document.scoringVersion,
    roleCatalogVersion: document.roleCatalogVersion,
    createdAt: new Date(document.createdAt).toISOString(),
    roleId: result.roleId,
    roleName: result.roleName,
    roleMatch: result.roleMatch,
    requirements: result.requirements,
    criticalGaps: result.criticalGaps,
  };
}

// Compares the user's latest Evidence Scores with one configured role and
// persists the result. Role weights, thresholds and scores all come from
// trusted server-side sources; the caller supplies only a role id.
export async function runGapAnalysis(userId: string, roleId: string): Promise<GapAnalysisDto> {
  const catalog = loadRoleCatalog();
  const role = findRole(catalog, roleId);

  if (!role) {
    throw new AppError(AuthErrorCode.ROLE_NOT_FOUND, 404, "Role not found.");
  }

  const latest = await getLatestAnalysis(userId);

  if (!latest) {
    throw new AppError(
      AuthErrorCode.NO_ANALYSIS,
      404,
      "No analysis is available yet. Analyze your repositories and score the evidence first.",
    );
  }

  const scores = new Map(latest.result.skillScores.map((entry) => [entry.skillId, entry.score]));
  let result: RoleMatchResult;

  try {
    result = computeRoleMatch({ role, scores, skillNames: skillNameMap() });
  } catch (error) {
    if (error instanceof RoleMatchInputError) {
      throw new AppError(AuthErrorCode.INVALID_ANALYSIS, 500, "The stored analysis is malformed.");
    }
    throw error;
  }

  const stored = await GapAnalysisModel.create({
    userId,
    analysisId: latest.summary.analysisId,
    roleId: role.id,
    scoringVersion: latest.summary.scoringVersion,
    roleCatalogVersion: catalog.roleCatalogVersion,
    roleCatalogHash: roleCatalogHash(),
    result,
  });

  return toDto({
    _id: stored._id,
    analysisId: stored.analysisId,
    scoringVersion: stored.scoringVersion,
    roleCatalogVersion: stored.roleCatalogVersion,
    createdAt: stored.createdAt,
    result: stored.result,
  });
}

// Ownership is part of the query itself, so a result belonging to another
// user is indistinguishable from one that does not exist.
export async function getGapAnalysis(userId: string, gapAnalysisId: string): Promise<GapAnalysisDto> {
  const document = await GapAnalysisModel.findOne({ _id: gapAnalysisId, userId }).lean();

  if (!document) {
    throw new AppError(AuthErrorCode.GAP_ANALYSIS_NOT_FOUND, 404, "Gap analysis not found.");
  }

  return toDto(document);
}
