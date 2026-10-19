import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RoleConfigError, parseRoleCatalog, type RoleCatalog } from "@nexus/domain";
import { loadEvidenceConfig } from "../evidence/evidence-config.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

// Resolved relative to this file so the loader is independent of the
// process's current working directory.
const ROLES_CONFIG_PATH = new URL("../../../../config/roles.json", import.meta.url);

let cachedCatalog: RoleCatalog | null = null;

// Loads and strictly validates config/roles.json against the canonical skill
// taxonomy. Invalid configuration fails loudly; it is never repaired.
export function loadRoleCatalog(): RoleCatalog {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const { taxonomy } = loadEvidenceConfig();

  try {
    cachedCatalog = parseRoleCatalog(
      JSON.parse(readFileSync(ROLES_CONFIG_PATH, "utf-8")),
      taxonomy.skills.map((skill) => skill.id),
    );
  } catch (error) {
    const message =
      error instanceof RoleConfigError ? error.message : "config/roles.json could not be loaded.";
    throw new AppError(AuthErrorCode.INVALID_ROLE_CONFIGURATION, 500, message);
  }

  return cachedCatalog;
}

// SHA-256 of the validated catalog, stored with each persisted gap analysis so
// a result can always be traced to the benchmarks that produced it.
export function roleCatalogHash(): string {
  return createHash("sha256").update(JSON.stringify(loadRoleCatalog())).digest("hex");
}

export function resetRoleCatalogCache(): void {
  cachedCatalog = null;
}
