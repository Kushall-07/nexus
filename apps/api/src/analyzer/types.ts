// Normalized, deterministic Phase 3 data model. Everything here is an
// observation ("what did we see?"), never a skill score, role match, or
// expertise claim. Phase 4/5 decide what these observations mean.

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size: number | null;
  sha: string;
}

export interface RepositoryTree {
  entries: TreeEntry[];
  truncated: boolean;
}

export type FileDecodeStatus =
  | "decoded"
  | "skipped_too_large"
  | "skipped_binary"
  | "skipped_not_found"
  | "skipped_malformed"
  | "skipped_budget";

export interface FetchedFile {
  path: string;
  size: number | null;
  status: FileDecodeStatus;
  content: string | null;
}

export type AnalyzerWarningCode =
  | "FILE_TOO_LARGE"
  | "BINARY_FILE_SKIPPED"
  | "MALFORMED_MANIFEST"
  | "UNSUPPORTED_MANIFEST"
  | "FILE_NOT_FOUND"
  | "BUDGET_EXHAUSTED"
  | "PARTIAL_SOURCE_INSPECTION"
  | "NO_LANGUAGE_DATA"
  | "TREE_TRUNCATED";

export interface AnalyzerWarning {
  code: AnalyzerWarningCode;
  path?: string;
  message: string;
}

export type SupportedManifest =
  | "package.json"
  | "requirements.txt"
  | "pyproject.toml"
  | "go.mod"
  | "pom.xml";

export type DependencyType = "runtime" | "dev" | "optional" | "peer" | "unknown";

export interface DependencyObservation {
  packageName: string;
  technology: string | null;
  source: SupportedManifest;
  sourcePath: string;
  dependencyType: DependencyType;
  versionConstraint: string | null;
}

export interface LanguageObservations {
  bytesByLanguage: Record<string, number>;
  percentageByLanguage: Record<string, number>;
  totalBytes: number;
}

export interface FrameworkEvidenceItem {
  type: "dependency" | "source" | "config";
  sourcePath: string;
  sourceReference: string;
}

export interface FrameworkObservation {
  technology: string;
  displayName: string;
  evidence: FrameworkEvidenceItem[];
}

export interface SourceUsageObservation {
  technology: string;
  displayName: string;
  importReferenceCount: number;
  relevantSourceFileCount: number;
  importSignal: number;
  fileUsageSignal: number;
  sourceUsage: number;
  relevantSourceFilePaths: string[];
  sampledSourceFilePaths: string[];
  bounded: boolean;
}

export type StructureCategory = "frontend" | "backend" | "ml" | "ai";

export interface StructureObservation {
  category: StructureCategory;
  detectedPaths: string[];
  relevantStructureSignalCount: number;
}

export interface DockerObservation {
  dockerfilePresent: boolean;
  composePresent: boolean;
  dockerfilePaths: string[];
  composePaths: string[];
}

export interface TestTechnologySignal {
  technology: string;
  skillReferencedTestFiles: number;
  skillSpecificTestSignal: number;
}

export interface TestObservation {
  testFileCount: number;
  sourceFileCount: number;
  testFilePaths: string[];
  testRatio: number;
  genericTestSignal: number;
  perTechnology: TestTechnologySignal[];
}

export interface DocumentationTechnologySignal {
  technology: string;
  skillMention: boolean;
  documentationSignal: number;
}

export interface DocumentationObservation {
  readmePresent: boolean;
  readmePath: string | null;
  readmeSize: number | null;
  perTechnology: DocumentationTechnologySignal[];
}

export interface ActivityObservation {
  recentCommitCount: number;
  activeDays: number;
  recentCommitSignal: number;
  activeDaySignal: number;
  activity: number;
  windowDays: number;
  sinceDate: string;
  bounded: boolean;
}

export interface RequestBudgetSummary {
  limit: number;
  used: number;
  remaining: number;
}

export interface RepositoryAnalysis {
  repositoryId: string;
  repositoryFullName: string;
  analyzedAt: string;
  languages: LanguageObservations;
  dependencies: DependencyObservation[];
  frameworks: FrameworkObservation[];
  sourceUsage: SourceUsageObservation[];
  projectStructure: StructureObservation[];
  docker: DockerObservation;
  testing: TestObservation;
  documentation: DocumentationObservation;
  activity: ActivityObservation;
  requestBudget: RequestBudgetSummary;
  warnings: AnalyzerWarning[];
}
