import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Starts the existing docker-compose MongoDB service (idempotent: reuses the
// nexus-mongodb container and its volume). Skipped when MONGODB_URI points at a
// non-local database. The URI is only inspected, never printed.
function configuredUri() {
  try {
    const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("MONGODB_URI="));
    return line ? line.slice("MONGODB_URI=".length).trim() : "";
  } catch {
    return "";
  }
}

const uri = configuredUri();

if (uri && !/(localhost|127\.0\.0\.1)/.test(uri)) {
  console.log("[DB] MONGODB_URI is not local; skipping Docker MongoDB.");
  process.exit(0);
}

const result = spawnSync("docker", ["compose", "up", "-d", "mongodb"], { stdio: "inherit", shell: process.platform === "win32" });

if (result.status !== 0) {
  console.error(
    "\n[DB] Could not start MongoDB. Make sure Docker Desktop is installed and running,\n" +
      "     then run `npm run dev` again (or start MongoDB yourself and set MONGODB_URI).",
  );
  process.exit(1);
}

console.log("[DB] MongoDB is running on localhost:27017.");
