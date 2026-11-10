// Response shapes of the career-platform endpoints (Phases 11-13).

export type EmploymentType = "internship" | "full-time" | "part-time" | "contract" | "other";
export type WorkMode = "remote" | "hybrid" | "on-site";
export type ExperienceLevel = "intern" | "entry" | "mid" | "senior" | "lead";
export type ApplicationStatus = "saved" | "planning" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
export type TaskStatus = "not_started" | "planned" | "in_progress" | "completed" | "skipped";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  planning: "Planning to apply",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export interface Job {
  id: string;
  provider: string;
  isDemo: boolean;
  title: string;
  company?: string;
  description: string;
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salary?: { min?: number; max?: number; currency?: string; period?: "year" | "month" | "hour" };
  requiredSkills: string[];
  preferredSkills: string[];
  studentOnly?: boolean;
  postedAt?: string;
  url: string;
  sourceName: string;
  retrievedAt: string;
  stale: boolean;
}

export type MatchLabel = "strong" | "potential" | "stretch" | "blocked" | "insufficient-evidence";

export interface SkillAssessment {
  skill: string;
  requirement: "required" | "preferred";
  status: "github" | "resume-only" | "missing";
  githubScore: number | null;
  projects: Array<{ fullName: string; url: string | null }>;
}

export interface JobMatch {
  jobId: string;
  matchingVersion: string;
  score: number | null;
  label: MatchLabel;
  confidence: "high" | "medium" | "low";
  components: Array<{ key: string; weight: number; value: number | null; note: string }>;
  skills: SkillAssessment[];
  preferenceMatches: { matched: string[]; mismatched: string[]; unknown: string[] };
  hardBlockers: string[];
  unresolvedEligibility: string[];
  unavailableInformation: string[];
  explanation: string[];
}

export interface OpportunityItem {
  job: Job;
  match: JobMatch;
  saved: { status: ApplicationStatus; note: string; statusDate: string | null } | null;
}

export interface ProviderOutcome {
  id: string;
  label: string;
  configured: boolean;
  hint?: string;
  ok: boolean;
  count: number;
  errorKind?: string;
  errorMessage?: string;
  cached?: boolean;
}

export interface EvidenceMeta {
  hasGithubAnalysis: boolean;
  githubAnalyzedAt: string | null;
  hasResume: boolean;
  resumeVersion: number | null;
}

export interface OpportunitySearchResponse {
  mode: "live" | "demo";
  noProviderConfigured: boolean;
  providers: ProviderOutcome[];
  retrievedAt: string;
  profile: EvidenceMeta;
  items: OpportunityItem[];
  dismissedCount: number;
}

export interface SavedJobRecord {
  jobId: string;
  job: Job;
  status: ApplicationStatus;
  dismissed: boolean;
  note: string;
  statusDate: string | null;
  updatedAt: string;
}

export interface CareerPreferences {
  directions: string[];
  employmentTypes: EmploymentType[];
  workModes: WorkMode[];
  locations: string[];
  experienceLevel?: ExperienceLevel;
  minSalary?: number;
  salaryCurrency?: string;
  isStudent?: boolean;
}

export type SkillSource = "resume" | "user-corrected" | "user-confirmed";

export interface ResumeProfile {
  name?: string;
  email?: string;
  phone?: string;
  links: string[];
  education: Array<{ institution?: string; degree?: string; field?: string; endYear?: number }>;
  experience: Array<{
    title?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    isInternship: boolean;
  }>;
  projects: Array<{ name: string; description?: string }>;
  skills: Array<{ name: string; source: SkillSource }>;
  certifications: string[];
}

export interface StoredResume {
  profile: ResumeProfile;
  version: number;
  fileName: string | null;
  fileType: "pdf" | "docx" | null;
  savedAt: string;
}

export interface RefreshState {
  status: "idle" | "running" | "succeeded" | "failed";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface CareerProfileResponse {
  preferences: CareerPreferences;
  resume: StoredResume | null;
  learning: { direction: string | null; tasks: Record<string, { status: TaskStatus; updatedAt: string }> };
  refresh: RefreshState;
  evidence: EvidenceMeta;
  directions: Array<{ id: string; displayName: string }>;
  llmConfigured: boolean;
}

export interface RefreshResult {
  status: "succeeded" | "failed";
  analyzedCount: number;
  skippedCount: number;
  failedCount: number;
  analysisId: string | null;
  message: string;
  profileIsStale: boolean;
}

export interface ResumeDraft {
  fileName: string;
  fileType: "pdf" | "docx";
  profile: ResumeProfile;
}

export type TransitionSkillStatus = "demonstrated" | "partial" | "resume-claimed" | "missing" | "unverified";

export interface TransitionGap {
  skillId: string;
  skillName: string;
  status: TransitionSkillStatus;
  githubScore: number | null;
  minimumScore: number | null;
  baselineWeight: number | null;
  demandCount: number;
  priority: number;
  prerequisites: Array<{ skillId: string; skillName: string; status: TransitionSkillStatus }>;
  whyItMatters: string;
  task: { learn: string; milestone: string; verification: string; effortHours?: [number, number] };
  taskStatus: TaskStatus | null;
}

export interface TransitionAnalysis {
  direction: { id: string; displayName: string };
  baseline: { source: "role-catalog"; version: string };
  demand: { source: "live" | "demo" | "none"; sampleSize: number; note: string };
  gaps: TransitionGap[];
  alreadyDemonstrated: Array<{ skillId: string; skillName: string; githubScore: number }>;
  nextAction: string;
  caveats: string[];
}

export type CopilotAction =
  // auto: the person asked to be taken there, so the app goes straight away instead of waiting for a click.
  | { kind: "navigate"; label: string; to: string; auto?: boolean }
  // Nexus presses this element on the page the person is looking at (hands-free).
  | { kind: "click"; elementId: number; label: string }
  // Nexus keeps this note for the rest of the conversation.
  | { kind: "remember"; note: string }
  | { kind: "refresh-profile"; label: string }
  | { kind: "set-direction"; label: string; directionId: string }
  | { kind: "search-demo"; label: string };

export type CopilotCard =
  | { type: "jobs"; source: "live" | "demo"; items: OpportunityItem[] }
  | { type: "transition"; analysis: TransitionAnalysis }
  | { type: "match"; job: Job; match: JobMatch };

export interface CopilotResponse {
  text: string;
  interpretedBy: "rules" | "llm" | "agent";
  intent: string;
  cards: CopilotCard[];
  actions: CopilotAction[];
  suggestions: string[];
  // Context to send back with the next turn (for example the ids of jobs just shown).
  memo?: string;
}
