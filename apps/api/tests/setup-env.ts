// Inert, test-only configuration. Set before any module reads src/config/env.ts so
// the suite never depends on (or leaks) a developer's real .env values. dotenv does
// not override variables that are already defined, even when empty.
const testEnv: Record<string, string> = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:1/nexus_unit_tests_unused",
  JWT_SECRET: "unit-test-jwt-secret-0123456789abcdef0123456789",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  FRONTEND_URL: "http://localhost:5173",
  BACKEND_URL: "http://localhost:4000",
  LLM_PROVIDER: "",
  LLM_API_KEY: "",
  LLM_MODEL: "",
  LLM_BASE_URL: "",
  JSEARCH_API_KEY: "",
  ADZUNA_APP_ID: "",
  ADZUNA_APP_KEY: "",
  REMOTIVE_ENABLED: "",
  ARBEITNOW_ENABLED: "",
  HIMALAYAS_ENABLED: "",
};

for (const [key, value] of Object.entries(testEnv)) {
  // Integration tests supply their own MONGODB_URI before this file runs.
  if (key === "MONGODB_URI" && process.env.NEXUS_TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.NEXUS_TEST_MONGODB_URI;
  } else {
    process.env[key] = value;
  }
}
