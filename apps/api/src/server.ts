import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./services/database.js";
import { loadRevokedSessions } from "./services/session.service.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startServer(): Promise<void> {
  await connectDatabase();
  await loadRevokedSessions();

  if (env.LLM_PROVIDER && !env.LLM_API_KEY) {
    console.warn("LLM_PROVIDER is set but LLM_API_KEY is missing: AI explanations are disabled.");
  }

  const server = app.listen(env.PORT, () => {
    console.log(`NEXUS API running on port ${env.PORT}`);
  });

  server.on("error", (error) => {
    console.error("NEXUS API server error:", error.message);
    process.exit(1);
  });

  let shuttingDown = false;

  // Stop accepting connections, let in-flight requests finish, then close MongoDB.
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down.`);

    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(() => {
      disconnectDatabase()
        .catch((error: unknown) => console.error("Database disconnect failed:", error instanceof Error ? error.message : error))
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  // Message only: a connection error can embed the database URI.
  console.error("Failed to start NEXUS API:", error instanceof Error ? error.name : "unknown error");
  process.exit(1);
});
