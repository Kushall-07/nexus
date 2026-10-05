import type { TechnologyConfig } from "../technology-config.js";
import type { SupportedManifest } from "../types.js";

// Resolves a raw dependency identifier (package name, Go module path, Maven
// artifactId, ...) against the centralized technology configuration for a
// given manifest type. Matching is deliberately conservative: exact,
// case-insensitive matches for most manifests, and a substring match only
// for pom.xml where configured identifiers are intentionally partial
// (e.g. "spring-boot-starter" matching "spring-boot-starter-web").
export function resolveTechnologyId(
  config: TechnologyConfig,
  manifest: SupportedManifest,
  identifier: string,
): string | null {
  const normalized = identifier.toLowerCase();

  for (const technology of config.technologies) {
    const identifiers = technology.dependencyIdentifiers[manifest];

    if (!identifiers) {
      continue;
    }

    for (const configured of identifiers) {
      const configuredLower = configured.toLowerCase();

      if (manifest === "pom.xml") {
        if (normalized.includes(configuredLower)) {
          return technology.id;
        }
        continue;
      }

      if (normalized === configuredLower) {
        return technology.id;
      }
    }
  }

  return null;
}

export function displayNameFor(config: TechnologyConfig, technologyId: string): string {
  const technology = config.technologies.find((item) => item.id === technologyId);
  return technology?.displayName ?? technologyId;
}
