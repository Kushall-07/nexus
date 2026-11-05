import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["source"] },
  ssr: { resolve: { conditions: ["source"], externalConditions: ["source"] } },
  test: { setupFiles: ["./tests/setup-env.ts"], testTimeout: 20000, hookTimeout: 20000, exclude: ["dist/**", "node_modules/**", "tests/smoke/**", "tests/integration/**"] },
});
