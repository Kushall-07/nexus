import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import githubRouter from "./routes/github.routes.js";
import analysisRouter from "./routes/analysis.routes.js";
import skillsRouter from "./routes/skills.routes.js";
import rolesRouter from "./routes/roles.routes.js";
import gapAnalysisRouter from "./routes/gap-analysis.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { rateLimitPerIp } from "./middleware/rate-limit.js";
import mongoose from "mongoose";
import { requireTrustedOrigin, securityHeaders } from "./middleware/browser-security.js";
import { env } from "./config/env.js";
import { careerRouter, copilotRouter, opportunitiesRouter, resumeRouter, savedJobsRouter } from "./career/career.routes.js";

const app = express();

// Number of trusted proxy hops: 0 = socket address (default), 1 = single proxy.
// Controls how Express resolves req.ip from X-Forwarded-For headers.
// Set TRUST_PROXY to match your deployment topology to prevent IP spoofing.
app.set("trust proxy", env.TRUST_PROXY);
app.disable("x-powered-by");
app.use(requestLogger);
app.use(securityHeaders);
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(requireTrustedOrigin);
// A reviewed resume profile can legitimately exceed 16kb, so only that route gets a larger JSON limit.
// Mounted first: body-parser skips a body that is already parsed.
app.use("/api/resume", express.json({ limit: "128kb" }));
// Every other JSON body in this API is a few dozen bytes; 16kb is generous.
app.use(express.json({ limit: "16kb" }));

// Global IP backstop for all /api/* routes: 500 req per 15 min per IP.
// Applies to both authenticated and unauthenticated endpoints. In-process only;
// each API instance enforces its own limit independently (single-instance private beta).
// Authenticated routes also carry tighter per-user limits (see individual routers).
//
// In test mode (NODE_ENV=test), E2E_RATE_LIMIT_MAX may raise the ceiling so that
// three parallel Playwright projects sharing the localhost IP do not exhaust the
// production default.  env.ts rejects E2E_RATE_LIMIT_MAX in all other environments,
// keeping the production default of 500 strictly unchanged.
const globalIpMax =
  env.NODE_ENV === "test" && env.E2E_RATE_LIMIT_MAX != null
    ? env.E2E_RATE_LIMIT_MAX
    : 500;
app.use("/api", rateLimitPerIp({ windowMs: 15 * 60_000, max: globalIpMax }));

// Liveness: the process is up. Says nothing about dependencies.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "nexus-api",
  });
});

// Readiness: MongoDB is connected. The optional LLM never affects this.
app.get("/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;

  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable", service: "nexus-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/github", githubRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/gap-analysis", gapAnalysisRouter);
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/saved-jobs", savedJobsRouter);
app.use("/api/career", careerRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/copilot", copilotRouter);

app.use(errorHandler);

export default app;