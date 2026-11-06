import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const correlationId = randomUUID();
  req.correlationId = correlationId;

  const start = Date.now();

  logger.info("request started", { correlationId, method: req.method, path: req.path });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    logger[level]("request finished", { correlationId, method: req.method, path: req.path, status, durationMs });
  });

  next();
}
