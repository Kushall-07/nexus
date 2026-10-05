import { AppError, AuthErrorCode } from "../utils/errors.js";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_USER_AGENT = "NEXUS-App";
const GITHUB_API_VERSION = "2022-11-28";

interface GithubRequestOptions {
  method?: string;
  searchParams?: Record<string, string>;
}

interface RateLimitInfo {
  remaining: number | null;
  resetAt: string | null;
}

function extractRateLimitInfo(response: Response): RateLimitInfo {
  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const resetHeader = response.headers.get("x-ratelimit-reset");

  return {
    remaining: remainingHeader !== null ? Number(remainingHeader) : null,
    resetAt:
      resetHeader !== null
        ? new Date(Number(resetHeader) * 1000).toISOString()
        : null,
  };
}

// Centralizes how GitHub HTTP responses are turned into NEXUS errors, so callers
// never need to inspect GitHub-specific status codes or bodies directly. The
// response body is intentionally never included in the thrown error.
function mapErrorResponse(response: Response): AppError {
  const rateLimit = extractRateLimitInfo(response);

  if (response.status === 401) {
    return new AppError(
      AuthErrorCode.GITHUB_TOKEN_EXPIRED,
      401,
      "GitHub access token is invalid or expired.",
    );
  }

  if (response.status === 403) {
    const isRateLimited =
      rateLimit.remaining === 0 || response.headers.has("retry-after");

    if (isRateLimited) {
      return new AppError(
        AuthErrorCode.GITHUB_RATE_LIMIT,
        429,
        "GitHub API rate limit exceeded.",
        { remaining: rateLimit.remaining ?? 0, resetAt: rateLimit.resetAt },
      );
    }

    return new AppError(
      AuthErrorCode.GITHUB_TOKEN_EXPIRED,
      403,
      "GitHub denied access for this token.",
    );
  }

  if (response.status === 404) {
    return new AppError(
      AuthErrorCode.GITHUB_NOT_FOUND,
      404,
      "The requested GitHub resource was not found.",
    );
  }

  if (response.status === 429) {
    return new AppError(
      AuthErrorCode.GITHUB_RATE_LIMIT,
      429,
      "GitHub API rate limit exceeded.",
      { remaining: rateLimit.remaining ?? 0, resetAt: rateLimit.resetAt },
    );
  }

  return new AppError(
    AuthErrorCode.GITHUB_SERVICE_UNAVAILABLE,
    502,
    "GitHub is currently unavailable.",
  );
}

// Authenticated request against the GitHub REST API. `accessToken` is used only
// to build the outbound Authorization header for this single call and is never
// logged, persisted, or included in any thrown error.
export async function githubRequest<T>(
  accessToken: string,
  path: string,
  options: GithubRequestOptions = {},
): Promise<{ data: T; response: Response }> {
  const url = new URL(`${GITHUB_API_BASE_URL}${path}`);

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": GITHUB_USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    });
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_SERVICE_UNAVAILABLE,
      502,
      "Unable to communicate with GitHub.",
    );
  }

  if (!response.ok) {
    throw mapErrorResponse(response);
  }

  let data: T;

  try {
    data = (await response.json()) as T;
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_SERVICE_UNAVAILABLE,
      502,
      "GitHub returned a malformed response.",
    );
  }

  return { data, response };
}
