import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "../config/auth.config.js";
import { verifySessionToken } from "../services/session.service.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (typeof token !== "string" || token.length === 0) {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Authentication required.",
    );
  }

  let payload;

  try {
    payload = verifySessionToken(token);
  } catch {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Invalid or expired session.",
    );
  }

  req.user = { id: payload.sub, githubId: payload.githubId };

  next();
}
