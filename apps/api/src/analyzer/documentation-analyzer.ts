import type { TechnologyConfig } from "./technology-config.js";
import type { DocumentationObservation, DocumentationTechnologySignal } from "./types.js";

export interface ReadmeInfo {
  path: string | null;
  size: number | null;
  content: string | null;
}

export function analyzeDocumentation(
  readme: ReadmeInfo,
  relevantTechnologyIds: string[],
  config: TechnologyConfig,
): DocumentationObservation {
  const readmePresent = readme.path !== null;
  const readmePresenceSignal = readmePresent ? 1 : 0;
  const lowerContent = readme.content?.toLowerCase() ?? null;

  const perTechnology: DocumentationTechnologySignal[] = [];

  for (const technologyId of [...relevantTechnologyIds].sort()) {
    const definition = config.technologies.find((item) => item.id === technologyId);
    const displayName = definition?.displayName.toLowerCase() ?? technologyId;

    const skillMention =
      lowerContent !== null &&
      (lowerContent.includes(technologyId.toLowerCase()) || lowerContent.includes(displayName));

    perTechnology.push({
      technology: technologyId,
      skillMention,
      documentationSignal: 0.5 * readmePresenceSignal + 0.5 * (skillMention ? 1 : 0),
    });
  }

  return {
    readmePresent,
    readmePath: readme.path,
    readmeSize: readme.size,
    perTechnology,
  };
}
