import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    // Opens the browser once when the dev server is ready (not on API restarts).
    open: true,
    // Same-origin API access in development so the session cookie is sent.
    proxy: { "/api": "http://localhost:4000" }
  }
});
