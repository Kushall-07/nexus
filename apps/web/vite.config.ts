import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    // Same-origin API access in development so the session cookie is sent.
    proxy: { "/api": "http://localhost:4000" }
  }
});
