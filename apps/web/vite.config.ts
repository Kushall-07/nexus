import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = dirname(fileURLToPath(import.meta.url));

const WASM_FILES: Record<string, string> = {
  "ort-wasm-simd-threaded.mjs": "text/javascript",
  "ort-wasm-simd-threaded.wasm": "application/wasm",
  "ort-wasm-simd-threaded.jsep.mjs": "text/javascript",
  "ort-wasm-simd-threaded.jsep.wasm": "application/wasm",
};

interface RuntimeFolder {
  /** URL prefix the files are served under, e.g. "/ort/". */
  prefix: string;
  /** Which runtime files this feature loads. Unused ones are left out to keep the deployed site small. */
  files: string[];
  /** Places the ONNX runtime for this feature may live in node_modules (first one that exists wins). */
  candidates: string[];
}

/**
 * Serves the ONNX runtime files that in-browser speech features need from this app's own origin, in
 * development and in the production build. That keeps them free of any CDN and lets them work offline
 * once their models have been downloaded.
 *
 *  /ort/         speech recognition (Whisper)
 *  /ort-kokoro/  the natural voice (Kokoro), which bundles its own, older runtime
 */
function onnxRuntimeAssets(folders: RuntimeFolder[]): Plugin {
  const resolved = folders
    .map((folder) => ({ prefix: folder.prefix, files: folder.files, dist: folder.candidates.find((dir) => existsSync(dir)) }))
    .filter((folder): folder is { prefix: string; files: string[]; dist: string } => folder.dist !== undefined);

  return {
    name: "nexus-onnx-runtime-assets",
    configureServer(server) {
      for (const { prefix, files, dist } of resolved) {
        server.middlewares.use(prefix, (request, response, next) => {
          const name = (request.url ?? "").split("?")[0].replace(/^\//, "");
          if (!files.includes(name) || !existsSync(resolve(dist, name))) return next();
          response.setHeader("Content-Type", WASM_FILES[name]!);
          response.setHeader("Cache-Control", "public, max-age=86400");
          response.end(readFileSync(resolve(dist, name)));
        });
      }
    },
    generateBundle() {
      for (const { prefix, files, dist } of resolved) {
        for (const name of files) {
          if (!existsSync(resolve(dist, name))) continue;
          this.emitFile({ type: "asset", fileName: `${prefix.replace(/^\/|\/$/g, "")}/${name}`, source: readFileSync(resolve(dist, name)) });
        }
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
  plugins: [
    react(),
    tailwindcss(),
    onnxRuntimeAssets([
      {
        prefix: "/ort/",
        files: ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"],
        candidates: [resolve(here, "node_modules/onnxruntime-web/dist"), resolve(here, "../../node_modules/onnxruntime-web/dist")],
      },
      {
        prefix: "/ort-kokoro/",
        files: Object.keys(WASM_FILES),
        candidates: [
          resolve(here, "node_modules/kokoro-js/node_modules/onnxruntime-web/dist"),
          resolve(here, "../../node_modules/kokoro-js/node_modules/onnxruntime-web/dist"),
        ],
      },
    ]),
  ],
  worker: { format: "es" },
  server: {
    // Opens the browser once when the dev server is ready (not on API restarts).
    open: true,
    // Same-origin API access in development so the session cookie is sent.
    proxy: { "/api": "http://localhost:4000" }
  }
});
