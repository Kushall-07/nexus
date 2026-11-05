import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";

const SERVER = fileURLToPath(new URL("../../dist/server.js", import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function startApi(port: number, mongoUri: string) {
  const output: string[] = [];
  // Deliberately fake values: nothing here is a real credential.
  const child = spawn(process.execPath, [SERVER], {
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: "development",
      PORT: String(port),
      MONGODB_URI: mongoUri,
      JWT_SECRET: "smoke-test-jwt-secret-0123456789abcdef0123",
      GITHUB_CLIENT_ID: "smoke-client-id",
      GITHUB_CLIENT_SECRET: "smoke-client-secret",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      FRONTEND_URL: "http://localhost:5173",
      BACKEND_URL: `http://localhost:${port}`,
    },
  });
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, output, exited };
}

async function waitFor(url: string, child: ChildProcess, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("API exited before becoming reachable");
    try {
      return await fetch(url);
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("API did not become reachable in time");
}

describe("built API (dist/server.js)", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    expect(existsSync(SERVER), "run `npm run build` before the smoke test").toBe(true);
    mongo = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    await mongo?.stop();
  });

  it("starts with plain node, reports liveness and readiness, enforces auth, and shuts down", async () => {
    const port = await freePort();
    const api = startApi(port, mongo.getUri("nexus_smoke"));

    try {
      const health = await waitFor(`http://127.0.0.1:${port}/health`, api.child, 30_000);
      expect(health.status).toBe(200);

      const ready = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(ready.status).toBe(200);
      expect(await ready.json()).toMatchObject({ status: "ready" });

      // Config files (roles, scoring, skills) resolve from the compiled layout.
      const roles = await fetch(`http://127.0.0.1:${port}/api/roles`);
      expect(roles.status).toBe(401);
      const jobs = await fetch(`http://127.0.0.1:${port}/api/opportunities`);
      expect(jobs.status).toBe(401);
    } finally {
      api.child.kill("SIGTERM");
    }

    const code = await api.exited;
    // Windows has no POSIX signals: SIGTERM terminates the process abruptly.
    if (process.platform !== "win32") expect(code).toBe(0);
    expect(api.output.join("")).not.toContain("smoke-test-jwt-secret");
  });

  it("fails fast with a non-zero exit and no connection string when MongoDB is unreachable", async () => {
    const port = await freePort();
    const closedPort = await freePort();
    const secretUri = `mongodb://smokeuser:smokepassword@127.0.0.1:${closedPort}/nexus_smoke`;
    const api = startApi(port, secretUri);

    const code = await api.exited;
    const text = api.output.join("");
    expect(code).not.toBe(0);
    expect(text).toContain("Failed to start NEXUS API");
    expect(text).not.toContain("smokepassword");
  });
});
