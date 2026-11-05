import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { AppError, AuthErrorCode } from "../utils/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
    console.error("MongoDB error:", err.name);

    res.status(500).json({
      success: false,
      error: {
        code: AuthErrorCode.MONGODB_ERROR,
        message: "A database error occurred.",
      },
    });
    return;
  }

  console.error("Unexpected error:", err instanceof Error ? err.message : err);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
