import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import githubRouter from "./routes/github.routes.js";
import analysisRouter from "./routes/analysis.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { env } from "./config/env.js";

const app = express();

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "nexus-api",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/github", githubRouter);
app.use("/api/analysis", analysisRouter);

app.use(errorHandler);

export default app;