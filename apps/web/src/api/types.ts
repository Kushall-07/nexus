// Response shapes of the NEXUS API as consumed by the web app. Every score,
// gap and role-match value is computed by the backend; the web app only
// displays what it receives.

export type SignalType =
  | "dependency"
  | "framework"
  | "sourceUsage"
  | "projectStructure"
  | "testing"
  | "documentation"
  | "activity";

export type SkillScoreStatus = "not-analyzed" | "no-evidence" | "scored";

export interface AnalysisSummary {
  analysisId: string;
  scoringVersion: string;
  createdAt: string;
  repositoryCount: number;
  evidenceCount: number;
}

export interface SkillOverviewItem {
  id: string;
  displayName: string;
  categoryId: string;
  score: number | null;
  status: SkillScoreStatus;
  repositoryCount: number;
}

export interface SkillOverview {
  analysis: AnalysisSummary | null;
  categories: Array<{ id: string; displayName: string; skills: SkillOverviewItem[] }>;
}

export interface SignalBreakdown {
  signal: SignalType;
  weight: number;
  applicable: boolean;
  strength: number;
  meaningful: boolean;
  evidenceCount: number;
  evidenceIds: string[];
}

export interface RepositoryReference {
  id: string;
  fullName: string | null;
  url: string | null;
}

export interface RepositoryScoreDetail {
  repository: RepositoryReference;
  repositorySkillScore: number;
  baseScore: number;
  breadthFactor: number;
  meaningfulSignalCount: number;
  applicableWeightSum: number;
  signals: SignalBreakdown[];
}

export interface ContributionDetail extends RepositoryScoreDetail {
  rank: number;
  repositorySubstance: number;
  rankMultiplier: number;
  contributionWeight: number;
}

export interface SkillDetail {
  skill: { id: string; displayName: string; categoryId: string; categoryName: string };
  analysis: AnalysisSummary | null;
  status: SkillScoreStatus;
  score: number | null;
  contributionWeightSum: number | null;
  contributions: ContributionDetail[];
  excludedRepositories: RepositoryScoreDetail[];
}

export interface EvidenceItem {
  repositoryId: string;
  skillId: string;
  evidenceType: string;
  signal: SignalType;
  value: string | number;
  normalizedStrength: number;
  sourcePath?: string;
  sourceReference?: string;
  explanation: string;
  detectedAt: string;
}

export interface SkillEvidenceResponse {
  skillId: string;
  evidence: EvidenceItem[];
}

export interface RoleRequirementDefinition {
  skillId: string;
  skillName: string;
  weight: number;
  minimumScore: number;
}

export interface RoleDefinition {
  id: string;
  displayName: string;
  requirements: RoleRequirementDefinition[];
}

export interface RoleCatalogResponse {
  catalogVersion: string;
  roles: RoleDefinition[];
}

export interface RoleRequirementResult {
  skillId: string;
  skillName: string;
  evidenceScore: number;
  evidenceAvailable: boolean;
  weight: number;
  minimumScore: number;
  weightedContribution: number;
  gap: number;
  deficit: number;
  criticalGap: boolean;
}

export interface GapAnalysisResponse {
  id: string;
  analysisId: string;
  scoringVersion: string;
  roleCatalogVersion: string;
  createdAt: string;
  roleId: string;
  roleName: string;
  roleMatch: number;
  requirements: RoleRequirementResult[];
  criticalGaps: RoleRequirementResult[];
}
