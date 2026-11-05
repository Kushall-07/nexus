import type { CareerPreferences, NormalizedJob } from "../types.js";
import { toSkillKey } from "../skill-vocabulary.js";
import { loadMatchingConfig } from "./matching-config.js";

// Phase 11 deterministic job matcher. Pure: no I/O, no clock, no randomness.
// It consumes existing skill scores (read-only) and a user-reviewed resume
// profile, and never changes what those inputs mean.
//
// Rules that shape every branch below:
//  - missing information is never a positive match and never a mismatch;
//  - a resume claim is not GitHub evidence;
//  - hard eligibility failures are surfaced separately from the weighted score;
//  - the score is a similarity heuristic, NOT a hiring probability.

export interface ProjectRef {
  fullName: string;
  url: string | null;
}

export interface MatchProfile {
  // Existing deterministic skill scores (0-100) keyed by skill id; null when the user has no analysis.
  githubScores: Map<string, number> | null;
  // Repositories that contributed to each skill's score.
  githubProjects: Map<string, ProjectRef[]>;
  resume: {
    skills: Set<string>; // skill keys (canonical id or lowercase text)
    experienceTexts: string[]; // titles + summaries, used only for relevance checks
  } | null;
  preferences: CareerPreferences;
}

export type MatchLabel = "strong" | "potential" | "stretch" | "blocked" | "insufficient-evidence";
export type Confidence = "high" | "medium" | "low";
export type SkillStatus = "github" | "resume-only" | "missing";

export interface SkillAssessment {
  skill: string;
  requirement: "required" | "preferred";
  status: SkillStatus;
  githubScore: number | null;
  projects: ProjectRef[];
}

export interface ComponentResult {
  key: "requiredSkills" | "githubProjects" | "resume" | "preferences" | "experienceEligibility";
  weight: number;
  value: number | null; // 0..1, null when it could not be computed fairly
  note: string;
}

export interface JobMatch {
  jobId: string;
  matchingVersion: string;
  score: number | null;
  label: MatchLabel;
  confidence: Confidence;
  components: ComponentResult[];
  skills: SkillAssessment[];
  preferenceMatches: { matched: string[]; mismatched: string[]; unknown: string[] };
  hardBlockers: string[];
  unresolvedEligibility: string[];
  unavailableInformation: string[];
  explanation: string[];
}

function assessSkills(job: NormalizedJob, profile: MatchProfile): SkillAssessment[] {
  const config = loadMatchingConfig();
  const seen = new Set<string>();
  const out: SkillAssessment[] = [];

  const add = (raw: string, requirement: "required" | "preferred") => {
    const skill = toSkillKey(raw);
    if (seen.has(skill)) return; // duplicate skills count once; required wins because it is added first
    seen.add(skill);

    const githubScore = profile.githubScores?.get(skill) ?? null;
    const supported = githubScore !== null && githubScore >= config.githubSupportMinScore;
    const claimed = profile.resume?.skills.has(skill) ?? false;

    out.push({
      skill,
      requirement,
      status: supported ? "github" : claimed ? "resume-only" : "missing",
      githubScore,
      projects: supported ? (profile.githubProjects.get(skill) ?? []) : [],
    });
  };

  job.requiredSkills.forEach((skill) => add(skill, "required"));
  job.preferredSkills.forEach((skill) => add(skill, "preferred"));
  return out;
}

function preferenceChecks(job: NormalizedJob, prefs: CareerPreferences) {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const unknown: string[] = [];

  const check = (label: string, applicable: boolean, jobKnown: boolean, ok: boolean) => {
    if (!applicable) return;
    if (!jobKnown) unknown.push(label);
    else (ok ? matched : mismatched).push(label);
  };

  check(
    "Employment type",
    prefs.employmentTypes.length > 0,
    job.employmentType !== undefined,
    job.employmentType !== undefined && prefs.employmentTypes.includes(job.employmentType),
  );
  check(
    "Work mode",
    prefs.workModes.length > 0,
    job.workMode !== undefined,
    job.workMode !== undefined && prefs.workModes.includes(job.workMode),
  );

  if (prefs.locations.length > 0) {
    const location = job.location?.toLowerCase();
    const remoteOk = job.workMode === "remote" && prefs.workModes.includes("remote");
    check(
      "Location",
      true,
      location !== undefined || job.workMode !== undefined,
      remoteOk || (location !== undefined && prefs.locations.some((wanted) => location.includes(wanted.toLowerCase()))),
    );
  }

  if (prefs.minSalary !== undefined) {
    const salary = job.salary;
    const currencyOk = !prefs.salaryCurrency || !salary?.currency || salary.currency.toUpperCase() === prefs.salaryCurrency.toUpperCase();
    // Only a yearly maximum in a matching currency is comparable.
    const comparable = salary?.max !== undefined && salary.period === "year" && currencyOk;
    check("Salary", true, comparable, comparable && (salary?.max ?? 0) >= prefs.minSalary);
  }

  return { matched, mismatched, unknown };
}

export function matchJob(job: NormalizedJob, profile: MatchProfile): JobMatch {
  const config = loadMatchingConfig();
  const w = config.weights;
  const skills = assessSkills(job, profile);
  const required = skills.filter((entry) => entry.requirement === "required");
  const unavailable: string[] = [];
  const explanation: string[] = [];

  if (required.length === 0) unavailable.push("The listing does not state recognisable required skills.");
  if (!job.salary) unavailable.push("Salary or stipend not provided.");
  if (!job.location && !job.workMode) unavailable.push("Location not provided.");
  if (!job.experienceLevel) unavailable.push("Experience level not provided.");

  const hasGithub = profile.githubScores !== null;
  const hasResume = profile.resume !== null;

  // 1. Required-skill alignment.
  let requiredValue: number | null = null;
  let requiredNote = "No required skills could be compared.";
  if (required.length > 0 && (hasGithub || hasResume)) {
    const github = required.filter((entry) => entry.status === "github").length;
    const resumeOnly = required.filter((entry) => entry.status === "resume-only").length;
    requiredValue = (github + resumeOnly * config.resumeOnlySkillCredit) / required.length;
    requiredNote = `${github} supported by GitHub evidence, ${resumeOnly} claimed only in the resume (partial credit), ${required.length - github - resumeOnly} missing or unverified, of ${required.length} required.`;
  } else if (required.length > 0) {
    requiredNote = "Add GitHub evidence or a resume profile to compare required skills.";
  }

  // 2. Relevant GitHub project evidence (only skills that have a GitHub score scale).
  let githubValue: number | null = null;
  let githubNote = "No GitHub analysis is available.";
  if (hasGithub) {
    const comparable = required.filter((entry) => profile.githubScores!.has(entry.skill) || isCanonical(entry.skill));
    if (comparable.length > 0) {
      githubValue = comparable.reduce((sum, entry) => sum + Math.min(1, (entry.githubScore ?? 0) / 100), 0) / comparable.length;
      githubNote = `Average Evidence Score across ${comparable.length} required skill(s) that GitHub analysis can measure.`;
    } else {
      githubNote = "None of the required skills can be measured by GitHub analysis.";
    }
  }

  // 3. Resume experience and qualifications.
  let resumeValue: number | null = null;
  let resumeNote = "No resume profile is available.";
  if (profile.resume && required.length > 0) {
    const claimed = required.filter((entry) => profile.resume!.skills.has(entry.skill)).length;
    const texts = profile.resume.experienceTexts.map((text) => text.toLowerCase());
    const relevantExperience = texts.length > 0 && texts.some((text) => required.some((entry) => text.includes(entry.skill)));
    resumeValue = 0.75 * (claimed / required.length) + 0.25 * (relevantExperience ? 1 : 0);
    resumeNote = `${claimed}/${required.length} required skills appear in the resume; ${relevantExperience ? "listed experience mentions a required skill" : "no listed experience mentions a required skill"}. Resume statements are unverified.`;
  } else if (profile.resume) {
    resumeNote = "No required skills to compare against the resume.";
  }

  // 4. Preferences.
  const prefs = preferenceChecks(job, profile.preferences);
  const comparablePrefs = prefs.matched.length + prefs.mismatched.length;
  const prefValue = comparablePrefs > 0 ? prefs.matched.length / comparablePrefs : null;
  const prefNote =
    comparablePrefs > 0
      ? `${prefs.matched.length} of ${comparablePrefs} comparable preference(s) match.`
      : "No saved preference could be compared with this listing.";

  // 5. Experience level and eligibility.
  const hardBlockers: string[] = [];
  const unresolved: string[] = [];
  let expValue: number | null = null;
  let expNote = "Experience level could not be compared.";
  const parts: number[] = [];
  const levels = config.experienceLevels;
  const userLevel = profile.preferences.experienceLevel;

  if (job.experienceLevel && userLevel) {
    const distance = levels.indexOf(job.experienceLevel) - levels.indexOf(userLevel);
    parts.push(distance <= 0 ? 1 : distance === 1 ? 0.5 : 0);
    expNote = `Listing targets ${job.experienceLevel}; your stated level is ${userLevel}.`;
    if (distance >= config.blockerLevelGap) {
      hardBlockers.push(`The listing targets ${job.experienceLevel} level, well above your stated ${userLevel} level.`);
    }
  } else if (job.experienceLevel && !userLevel) {
    unresolved.push(`The listing targets ${job.experienceLevel} level; set your experience level in preferences.`);
  }

  if (job.studentOnly) {
    const isStudent = profile.preferences.isStudent;
    if (isStudent === false) {
      hardBlockers.push("The listing is limited to students and your profile says you are not currently a student.");
      parts.push(0);
    } else if (isStudent === true) {
      parts.push(1);
    } else {
      unresolved.push("The listing appears limited to students; confirm your student status in preferences.");
    }
  }
  if (parts.length > 0) expValue = parts.reduce((a, b) => a + b, 0) / parts.length;

  const components: ComponentResult[] = [
    { key: "requiredSkills", weight: w.requiredSkills, value: requiredValue, note: requiredNote },
    { key: "githubProjects", weight: w.githubProjects, value: githubValue, note: githubNote },
    { key: "resume", weight: w.resume, value: resumeValue, note: resumeNote },
    { key: "preferences", weight: w.preferences, value: prefValue, note: prefNote },
    { key: "experienceEligibility", weight: w.experienceEligibility, value: expValue, note: expNote },
  ];

  const available = components.filter((component) => component.value !== null);
  const availableWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const sourceCount = (hasGithub ? 1 : 0) + (hasResume ? 1 : 0);

  let score: number | null = null;
  let label: MatchLabel = "insufficient-evidence";

  const enough = requiredValue !== null && sourceCount > 0 && availableWeight >= config.minimumAvailableWeight;

  if (enough) {
    // Renormalise over the components that could be computed; absent ones are neither rewarded nor punished.
    score = Math.round((available.reduce((sum, c) => sum + c.weight * (c.value ?? 0), 0) / availableWeight) * 100);
    label = score >= config.labels.strong ? "strong" : score >= config.labels.potential ? "potential" : "stretch";
    explanation.push(
      `Score ${score}/100 is a weighted similarity across ${available.length} of 5 components (${Math.round(availableWeight * 100)}% of the model weight). It is not a hiring probability.`,
    );
  } else {
    explanation.push("There is not enough information to compute a fair match score for this listing.");
  }

  if (hardBlockers.length > 0) {
    label = "blocked";
    explanation.push("A hard eligibility failure is shown separately and is not hidden by the weighted score.");
  }

  const confidence: Confidence =
    sourceCount === 2 && required.length >= 3 ? "high" : sourceCount >= 1 && required.length >= 3 ? "medium" : sourceCount === 2 ? "medium" : "low";

  return {
    jobId: job.id,
    matchingVersion: config.matchingVersion,
    score,
    label,
    confidence,
    components,
    skills,
    preferenceMatches: prefs,
    hardBlockers,
    unresolvedEligibility: unresolved,
    unavailableInformation: unavailable,
    explanation,
  };
}

function isCanonical(skill: string): boolean {
  return Object.prototype.hasOwnProperty.call(loadMatchingConfig().skillAliases, skill);
}

const LABEL_ORDER: Record<MatchLabel, number> = { strong: 0, potential: 1, stretch: 2, blocked: 3, "insufficient-evidence": 4 };

// Deterministic ordering: label tier, then score, then job id.
export function rankMatches<T extends { match: JobMatch }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      LABEL_ORDER[a.match.label] - LABEL_ORDER[b.match.label] ||
      (b.match.score ?? -1) - (a.match.score ?? -1) ||
      a.match.jobId.localeCompare(b.match.jobId),
  );
}
