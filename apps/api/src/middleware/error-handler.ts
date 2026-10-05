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
