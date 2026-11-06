import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = req.correlationId;
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.extra ?? {}) },
    });
    return;
  }

  // body-parser failures carry a client-error status and a stable `type`.
  const parserType = (err as { type?: unknown } | null)?.type;

  if (parserType === "entity.too.large") {
    res.status(413).json({
      success: false,
      error: { code: AuthErrorCode.PAYLOAD_TOO_LARGE, message: "Request body is too large." },
    });
    return;
  }

  if ((typeof parserType === "string" && parserType.startsWith("entity.")) || parserType === "encoding.unsupported" || parserType === "charset.unsupported") {
    res.status(400).json({
      success: false,
      error: { code: AuthErrorCode.VALIDATION_ERROR, message: "Invalid request body." },
    });
    return;
  }

  if (err instanceof mongoose.Error) {
    logger.error("MongoDB error", { correlationId, name: err.name });

    res.status(500).json({
      success: false,
      error: {
        code: AuthErrorCode.MONGODB_ERROR,
        message: "A database error occurred.",
      },
    });
    return;
  }

  // Log only the error class and message — never a stack trace or any value
  // that could contain a credential (e.g. a connection string).
  logger.error("Unexpected error", {
    correlationId,
    name: err instanceof Error ? err.constructor.name : typeof err,
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
