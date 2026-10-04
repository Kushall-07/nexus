import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./services/database.js";

async function startServer(): Promise<void> {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`NEXUS API running on port ${env.PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start NEXUS API:", error);
  process.exit(1);
});