/**
 * Vite configuration for the Phase 6C isolated E2E environment.
 *
 * Key differences from vite.config.ts:
 *   - Port 5174 (not 5173) — avoids conflicting with the development server.
 *   - strictPort: true — fail immediately if 5174 is occupied rather than
 *     silently bumping to the next available port.
 *   - Proxy /api → http://localhost:4001 (E2E API, not development API 4000).
 *   - open: false — Playwright controls the browser; do not auto-open.
 *
 * Used exclusively by Playwright webServer.
 * Not used by `npm run dev` or the unit-test suite.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    open: false,
    proxy: {
      "/api": "http://localhost:4001",
    },
  },
});
