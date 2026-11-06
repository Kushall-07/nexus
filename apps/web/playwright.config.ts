import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e/results.json" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The dev server proxies /api to localhost:4000
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "tablet",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
  // Dev servers are assumed already running (started externally)
  webServer: undefined,
});
