import type { HydratedDocument } from "mongoose";
import { env } from "../config/env.js";
import {
  RepositoryModel,
  type RepositoryDocument,
} from "../models/repository.model.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { githubRequest } from "./github-client.service.js";
import { RequestBudget, executeWithBudget } from "./request-budget.js";

type RepositoryHydratedDocument = HydratedDocument<RepositoryDocument>;

// Repository discovery is bounded to a fixed number of pages regardless of how
// many repositories a GitHub account has, so a single discovery request can
// never turn into hundreds of GitHub API calls. `truncated` tells the caller
// (and ultimately the frontend) when this bound was actually hit, so the
// behavior is transparent rather than a silent truncation.
const DISCOVERY_PER_PAGE = 100;
const DISCOVERY_MAX_PAGES = 3;

interface GithubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string | null;
  updated_at: string | null;
  pushed_at: string | null;
}

interface NormalizedRepository {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  metadata: {
    visibility: "public";
    defaultBranch: string;
    isFork: boolean;
    isArchived: boolean;
    primaryLanguage: string | null;
    stars: number;
    forks: number;
    githubCreatedAt: Date | null;
    githubUpdatedAt: Date | null;
    githubPushedAt: Date | null;
  };
}

function normalizeRepository(raw: GithubRepoResponse): NormalizedRepository {
  return {
    githubId: raw.id,
    owner: raw.owner.login,
    name: raw.name,
    fullName: raw.full_name,
    url: raw.html_url,
    description: raw.description,
    metadata: {
      visibility: "public",
      defaultBranch: raw.default_branch,
      isFork: raw.fork,
      isArchived: raw.archived,
      primaryLanguage: raw.language,
      stars: raw.stargazers_count,
      forks: raw.forks_count,
      githubCreatedAt: raw.created_at ? new Date(raw.created_at) : null,
      githubUpdatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
      githubPushedAt: raw.pushed_at ? new Date(raw.pushed_at) : null,
    },
  };
}

// Discovers the authenticated GitHub account's own public repositories.
// Scope: owner affiliation only, public visibility only (defense in depth:
// results are also filtered client-side in case GitHub ever returns a
// private repository for a malformed request).
export async function discoverPublicRepositories(
  accessToken: string,
): Promise<{ repositories: NormalizedRepository[]; truncated: boolean }> {
  const collected: GithubRepoResponse[] = [];
  let truncated = false;

  for (let page = 1; page <= DISCOVERY_MAX_PAGES; page += 1) {
    const { data } = await githubRequest<GithubRepoResponse[]>(
      accessToken,
      "/user/repos",
      {
        searchParams: {
          visibility: "public",
          affiliation: "owner",
          sort: "updated",
          per_page: String(DISCOVERY_PER_PAGE),
          page: String(page),
        },
      },
    );

    collected.push(...data);

    if (data.length < DISCOVERY_PER_PAGE) {
      break;
    }

    if (page === DISCOVERY_MAX_PAGES) {
      truncated = true;
    }
  }

  const publicOnly = collected.filter((repo) => repo.private !== true);

  return { repositories: publicOnly.map(normalizeRepository), truncated };
}

// Upserts discovered repositories for the user. Deliberately does not touch
// `selected`, `analyzed`, or `analyzedAt` so that explicit selection state and
// future analysis results survive repeated discovery calls. Repositories no
// longer returned by GitHub are left in place rather than deleted.
export async function persistDiscoveredRepositories(
  userId: string,
  repositories: NormalizedRepository[],
): Promise<void> {
  if (repositories.length === 0) {
    return;
  }

  await RepositoryModel.bulkWrite(
    repositories.map((repo) => ({
      updateOne: {
        filter: { userId, githubId: repo.githubId },
        update: {
          $set: {
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName,
            url: repo.url,
            description: repo.description,
            metadata: repo.metadata,
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function listRepositoriesForUser(
  userId: string,
): Promise<RepositoryHydratedDocument[]> {
  return RepositoryModel.find({ userId }).sort({ "metadata.githubPushedAt": -1 });
}

async function fetchRepositoryLanguages(
  accessToken: string,
  owner: string,
  name: string,
): Promise<Record<string, number>> {
  const { data } = await githubRequest<Record<string, number>>(
    accessToken,
    `/repos/${owner}/${name}/languages`,
  );

  return data;
}

// Returns a single repository owned by the authenticated user, lazily fetching
// and caching its language breakdown on first access. Subsequent detail views
// reuse the cached languages rather than spending GitHub quota again.
export async function getRepositoryDetail(
  userId: string,
  repositoryId: string,
  accessToken: string,
): Promise<RepositoryHydratedDocument> {
  const repo = await RepositoryModel.findOne({ _id: repositoryId, userId });

  if (!repo) {
    throw new AppError(
      AuthErrorCode.REPOSITORY_NOT_FOUND,
      404,
      "Repository not found.",
    );
  }

  if (!repo.languages || repo.languages.size === 0) {
    const budget = new RequestBudget(env.MAX_REQUESTS_PER_REPOSITORY);

    const languages = await executeWithBudget(budget, 1, () =>
      fetchRepositoryLanguages(accessToken, repo.owner, repo.name),
    );

    repo.languages = new Map(Object.entries(languages));
    await repo.save();
  }

  return repo;
}

export function mapToObject(
  map: Map<string, number> | null | undefined,
): Record<string, number> {
  if (!map) {
    return {};
  }

  return Object.fromEntries(map.entries());
}

// Language bytes are an evidence signal for later phases, not a score. This
// derives display percentages on the fly; nothing is stored.
function computeLanguagePercentages(
  languages: Record<string, number>,
): Record<string, number> {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);

  if (total === 0) {
    return {};
  }

  const percentages: Record<string, number> = {};

  for (const [language, bytes] of Object.entries(languages)) {
    percentages[language] = Math.round((bytes / total) * 10000) / 100;
  }

  return percentages;
}

export interface RepositoryResponseDTO {
  id: string;
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  visibility: "public";
  defaultBranch: string | null;
  isFork: boolean;
  isArchived: boolean;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  githubCreatedAt: string | null;
  githubUpdatedAt: string | null;
  githubPushedAt: string | null;
  languages: Record<string, number> | null;
  languagePercentages: Record<string, number>;
  selected: boolean;
  analyzed: boolean;
  analyzedAt: string | null;
}

// Never includes GitHub tokens, encrypted tokens, or any other internal/secret
// field: only the fixed set of normalized repository fields below.
export function toRepositoryDTO(
  repo: RepositoryHydratedDocument,
): RepositoryResponseDTO {
  const languagesObject = mapToObject(repo.languages);
  const hasLanguages = Object.keys(languagesObject).length > 0;

  return {
    id: repo._id.toString(),
    githubId: repo.githubId,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    url: repo.url,
    description: repo.description ?? null,
    visibility: repo.metadata?.visibility ?? "public",
    defaultBranch: repo.metadata?.defaultBranch ?? null,
    isFork: repo.metadata?.isFork ?? false,
    isArchived: repo.metadata?.isArchived ?? false,
    primaryLanguage: repo.metadata?.primaryLanguage ?? null,
    stars: repo.metadata?.stars ?? 0,
    forks: repo.metadata?.forks ?? 0,
    githubCreatedAt: repo.metadata?.githubCreatedAt?.toISOString() ?? null,
    githubUpdatedAt: repo.metadata?.githubUpdatedAt?.toISOString() ?? null,
    githubPushedAt: repo.metadata?.githubPushedAt?.toISOString() ?? null,
    languages: hasLanguages ? languagesObject : null,
    languagePercentages: computeLanguagePercentages(languagesObject),
    selected: repo.selected,
    analyzed: repo.analyzed,
    analyzedAt: repo.analyzedAt ? repo.analyzedAt.toISOString() : null,
  };
}
