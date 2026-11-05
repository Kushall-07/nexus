import { defineConfig } from "vitest/config";

// Exercises the compiled artifact (dist/server.js); run `npm run build` first.
export default defineConfig({
  test: { include: ["tests/smoke/**/*.smoke.test.ts"], testTimeout: 120_000, hookTimeout: 240_000 },
});
