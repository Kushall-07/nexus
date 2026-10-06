import { readFileSync } from "node:fs";
import { z } from "zod";
import type { StructureCategory, SupportedManifest } from "./types.js";

const technologySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  skillIds: z.array(z.string().min(1)).default([]),
  dependencyIdentifiers: z.record(z.string(), z.array(z.string())).default({}),
  sourceImportPatterns: z.array(z.string()).default([]),
  sourceFileExtensions: z.array(z.string()).default([]),
  configFilePatterns: z.array(z.string()).default([]),
});

// Phase 4 mappings from observations to taxonomy skill ids. They live in the
// same file as the technology definitions so technology/skill mapping has one
// canonical source.
const observationSkillsSchema = z.object({
  docker: z.array(z.string().min(1)).default([]),
  genericTesting: z.array(z.string().min(1)).default([]),
  structure: z.record(z.string(), z.array(z.string().min(1))).default({}),
});

const technologyConfigSchema = z.object({
  manifestTypes: z.array(z.string()),
  technologies: z.array(technologySchema),
  structureCategories: z.record(z.string(), z.array(z.string())),
  languageSkills: z.record(z.string(), z.string().min(1)).default({}),
  observationSkills: observationSkillsSchema.default({ docker: [], genericTesting: [], structure: {} }),
});

export interface ObservationSkillMappings {
  docker: string[];
  genericTesting: string[];
  structure: Record<string, string[]>;
}

export interface TechnologyDefinition {
  id: string;
  displayName: string;
  category: string;
  skillIds: string[];
  dependencyIdentifiers: Partial<Record<SupportedManifest, string[]>>;
  sourceImportPatterns: RegExp[];
  sourceFileExtensions: string[];
  configFilePatterns: string[];
}

export interface TechnologyConfig {
  manifestTypes: SupportedManifest[];
  technologies: TechnologyDefinition[];
  structureCategories: Record<StructureCategory, string[]>;
  languageSkills: Record<string, string>;
  observationSkills: ObservationSkillMappings;
}

// Resolved relative to this file's own location so the loader works
// regardless of the process's current working directory.
const CONFIG_PATH = new URL("../../../../config/technologies.json", import.meta.url);

function compileTechnology(
  raw: z.infer<typeof technologySchema>,
): TechnologyDefinition {
  return {
    id: raw.id,
    displayName: raw.displayName,
    category: raw.category,
    skillIds: raw.skillIds,
    dependencyIdentifiers: raw.dependencyIdentifiers as Partial<
      Record<SupportedManifest, string[]>
    >,
    sourceImportPatterns: raw.sourceImportPatterns.map((pattern) => new RegExp(pattern)),
    sourceFileExtensions: raw.sourceFileExtensions,
    configFilePatterns: raw.configFilePatterns,
  };
}

let cachedConfig: TechnologyConfig | null = null;

// Technology/structure mappings are loaded once per process and cached;
// the file is a static deployment artifact, never user- or repository-
// controlled input, so re-parsing on every analysis would be pure overhead.
export function loadTechnologyConfig(): TechnologyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = technologyConfigSchema.parse(JSON.parse(raw));

  cachedConfig = {
    manifestTypes: parsed.manifestTypes as SupportedManifest[],
    technologies: parsed.technologies.map(compileTechnology),
    structureCategories: parsed.structureCategories as Record<StructureCategory, string[]>,
    languageSkills: parsed.languageSkills,
    observationSkills: parsed.observationSkills,
  };

  return cachedConfig;
}

export function resetTechnologyConfigCache(): void {
  cachedConfig = null;
}
