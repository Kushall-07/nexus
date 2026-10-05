export const AuthErrorCode = {
  INVALID_AUTH: "INVALID_AUTH",
  GITHUB_AUTH_FAILED: "GITHUB_AUTH_FAILED",
  GITHUB_TOKEN_EXPIRED: "GITHUB_TOKEN_EXPIRED",
  GITHUB_RATE_LIMIT: "GITHUB_RATE_LIMIT",
  GITHUB_NOT_FOUND: "GITHUB_NOT_FOUND",
  GITHUB_SERVICE_UNAVAILABLE: "GITHUB_SERVICE_UNAVAILABLE",
  REPOSITORY_NOT_FOUND: "REPOSITORY_NOT_FOUND",
  INVALID_REPOSITORY_SELECTION: "INVALID_REPOSITORY_SELECTION",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  MONGODB_ERROR: "MONGODB_ERROR",
} as const;

export type AuthErrorCodeValue =
  (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly extra?: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}
