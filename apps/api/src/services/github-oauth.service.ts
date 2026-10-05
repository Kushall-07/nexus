import { env } from "../config/env.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

const GITHUB_USER_AGENT = "NEXUS-App";

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id?: number;
  login?: string;
}

export interface GithubIdentity {
  githubId: string;
  username: string;
}

export async function exchangeCodeForAccessToken(
  code: string,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${env.BACKEND_URL}/api/auth/github/callback`,
      }),
    });
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "Unable to communicate with GitHub.",
    );
  }

  if (!response.ok) {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "GitHub token exchange failed.",
    );
  }

  let data: GithubTokenResponse;

  try {
    data = (await response.json()) as GithubTokenResponse;
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "GitHub returned a malformed token response.",
    );
  }

  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      data.error_description ?? "GitHub did not return an access token.",
    );
  }

  return data.access_token;
}

export async function fetchGithubIdentity(
  accessToken: string,
): Promise<GithubIdentity> {
  let response: Response;

  try {
    response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": GITHUB_USER_AGENT,
      },
    });
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "Unable to retrieve GitHub identity.",
    );
  }

  if (!response.ok) {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "GitHub rejected the identity request.",
    );
  }

  let data: GithubUserResponse;

  try {
    data = (await response.json()) as GithubUserResponse;
  } catch {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "GitHub returned a malformed identity response.",
    );
  }

  if (typeof data.id !== "number" || typeof data.login !== "string" || data.login.length === 0) {
    throw new AppError(
      AuthErrorCode.GITHUB_AUTH_FAILED,
      502,
      "GitHub identity response is missing required fields.",
    );
  }

  return { githubId: String(data.id), username: data.login };
}
