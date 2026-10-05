export const AuthErrorCode = {
  INVALID_AUTH: "INVALID_AUTH",
  GITHUB_AUTH_FAILED: "GITHUB_AUTH_FAILED",
  GITHUB_TOKEN_EXPIRED: "GITHUB_TOKEN_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  MONGODB_ERROR: "MONGODB_ERROR",
} as const;

export type AuthErrorCodeValue =
  (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}
