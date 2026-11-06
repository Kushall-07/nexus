/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional API base URL for production deployments where the frontend is
   * hosted separately from the API.  Leave unset in development — Vite's proxy
   * routes /api/* to localhost:4000 automatically.
   *
   * Example: https://api.example.com
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
