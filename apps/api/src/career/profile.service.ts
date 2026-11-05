import { RepositoryModel } from "../models/repository.model.js";
import { getLatestAnalysis } from "../services/skill-profile.service.js";
import { getCareerProfile, type CareerProfile } from "./career-store.js";
import type { MatchProfile, ProjectRef } from "./matching/job-matcher.js";
import { toSkillKey } from "./skill-vocabulary.js";

export interface ProfileContext {
  match: MatchProfile;
  career: CareerProfile;
  meta: {
    hasGithubAnalysis: boolean;
    githubAnalyzedAt: string | null;
    hasResume: boolean;
    resumeVersion: number | null;
  };
}

// Read-only assembly of everything the matcher needs. GitHub evidence and
// resume claims stay in separate structures: nothing here upgrades a resume
// claim into demonstrated evidence.
export async function loadProfileContext(userId: string): Promise<ProfileContext> {
  const [latest, career] = await Promise.all([getLatestAnalysis(userId), getCareerProfile(userId)]);

  let githubScores: Map<string, number> | null = null;
  const githubProjects = new Map<string, ProjectRef[]>();

  if (latest) {
    githubScores = new Map(latest.result.skillScores.map((entry) => [entry.skillId, entry.score]));

    const repositoryIds = [
      ...new Set(latest.result.skillScores.flatMap((entry) => entry.contributions.map((c) => c.repositoryId))),
    ];
    const repositories = repositoryIds.length > 0 ? await RepositoryModel.find({ userId, _id: { $in: repositoryIds } }).lean() : [];
    const byId = new Map(repositories.map((repo) => [String(repo._id), repo]));

    for (const entry of latest.result.skillScores) {
      const refs: ProjectRef[] = [];
      for (const contribution of entry.contributions) {
        const repo = byId.get(contribution.repositoryId);
        if (repo?.fullName) refs.push({ fullName: repo.fullName, url: repo.url ?? null });
      }
      githubProjects.set(entry.skillId, refs);
    }
  }

  const resume = career.resume
    ? {
        skills: new Set(career.resume.profile.skills.map((skill) => toSkillKey(skill.name))),
        experienceTexts: career.resume.profile.experience.map((item) => `${item.title ?? ""} ${item.summary ?? ""}`),
      }
    : null;

  return {
    match: { githubScores, githubProjects, resume, preferences: career.preferences },
    career,
    meta: {
      hasGithubAnalysis: latest !== null,
      githubAnalyzedAt: latest?.summary.createdAt ?? null,
      hasResume: career.resume !== null,
      resumeVersion: career.resume?.version ?? null,
    },
  };
}
