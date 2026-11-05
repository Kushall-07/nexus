import { defineConfig } from "vitest/config";

// Runs against a disposable in-memory MongoDB (downloaded once by
// mongodb-memory-server). Never points at a real database.
export default defineConfig({
  resolve: { conditions: ["source"] },
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 240_000,
    fileParallelism: false,
  },
});
