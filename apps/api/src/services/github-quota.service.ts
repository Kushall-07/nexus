import { githubRequest } from "./github-client.service.js";

interface GithubRateLimitResponse {
  resources: {
    core: {
      limit: number;
      remaining: number;
      reset: number;
    };
  };
}

export interface GithubQuota {
  limit: number;
  remaining: number;
  resetAt: string;
}

// A single, explicit GitHub request. Callers must not invoke this repeatedly
// (e.g. once per repository card) — quota itself is a finite GitHub resource.
export async function getGithubQuota(accessToken: string): Promise<GithubQuota> {
  const { data } = await githubRequest<GithubRateLimitResponse>(
    accessToken,
    "/rate_limit",
  );

  const { core } = data.resources;

  return {
    limit: core.limit,
    remaining: core.remaining,
    resetAt: new Date(core.reset * 1000).toISOString(),
  };
}
