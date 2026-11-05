import { findRole, findSkill } from "@nexus/domain";
import { loadEvidenceConfig } from "../../evidence/evidence-config.js";
import { loadRoleCatalog } from "../../roles/role-config.js";
import { AppError, AuthErrorCode } from "../../utils/errors.js";
import { setDirection } from "../career-store.js";
import { getJobService } from "../jobs/job-service.js";
import { loadMatchingConfig } from "../matching/matching-config.js";
import { loadProfileContext } from "../profile.service.js";
import { resolveDirection } from "../skill-vocabulary.js";
import { analyzeTransition, type TransitionAnalysis } from "./transition-analysis.js";

export interface DirectionOption {
  id: string;
  displayName: string;
}

export function listDirections(): DirectionOption[] {
  return loadRoleCatalog().roles.map((role) => ({ id: role.id, displayName: role.displayName }));
}

// Accepts only ids that exist in the controlled vocabulary.
export function requireDirection(value: string): string {
  const id = loadRoleCatalog().roles.some((role) => role.id === value) ? value : resolveDirection(value);
  if (!id || !loadRoleCatalog().roles.some((role) => role.id === id)) {
    throw new AppError(AuthErrorCode.ROLE_NOT_FOUND, 404, "Unknown career direction.");
  }
  return id;
}

export async function changeDirection(userId: string, directionId: string | null): Promise<string | null> {
  const id = directionId === null ? null : requireDirection(directionId);
  await setDirection(userId, id);
  return id;
}

export async function buildTransitionPlan(
  userId: string,
  options: { directionId?: string; source?: "live" | "demo" } = {},
): Promise<TransitionAnalysis> {
  const context = await loadProfileContext(userId);
  const directionId = requireDirection(options.directionId ?? context.career.learning.direction ?? context.career.preferences.directions[0] ?? "");

  const catalog = loadRoleCatalog();
  const role = findRole(catalog, directionId)!;
  const { taxonomy } = loadEvidenceConfig();

  // Employer-demand sample: one bounded search per plan (never one per skill).
  const keywords = loadMatchingConfig().directionKeywords[directionId]?.[0] ?? role.displayName;
  const search = await getJobService().search({ keywords, limit: 30, page: 1 }, options.source ?? "live");
  const usable = search.mode === "demo" || !search.noProviderConfigured;
  const jobs = usable ? search.jobs : [];

  return analyzeTransition({
    role,
    roleCatalogVersion: catalog.roleCatalogVersion,
    skillName: (skillId) => findSkill(taxonomy, skillId)?.displayName ?? skillId,
    profile: context.match,
    demandJobs: jobs,
    demandSource: jobs.length === 0 ? "none" : search.mode,
    taskStatuses: context.career.learning.tasks,
  });
}
