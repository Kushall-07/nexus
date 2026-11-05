import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: new URL("../../../../.env", import.meta.url),
});

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());

const LLM_PROVIDERS = ["groq", "gemini", "openai-compatible"] as const;

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(32),

  GITHUB_CLIENT_ID: z.string().min(1),

  GITHUB_CLIENT_SECRET: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  FRONTEND_URL: z.string().url(),

  BACKEND_URL: z.string().url(),

  MAX_REPOSITORIES_PER_ANALYSIS: z.coerce.number().int().min(1).default(15),

  MAX_REQUESTS_PER_REPOSITORY: z.coerce.number().int().min(1).default(10),

  // Optional Phase 8 explanation provider. Blank values mean "not configured".
  LLM_PROVIDER: z.preprocess(
    (value) => {
      const blank = blankToUndefined(value);
      return typeof blank === "string" ? blank.trim().toLowerCase() : blank;
    },
    z.enum(LLM_PROVIDERS).optional(),
  ),
  LLM_API_KEY: optionalString,
  LLM_MODEL: optionalString,
  LLM_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),

  // Optional Phase 11 job providers. Each is enabled only when its credentials
  // are present; none is required (the app falls back to labelled demo data).
  JSEARCH_API_KEY: optionalString,
  ADZUNA_APP_ID: optionalString,
  ADZUNA_APP_KEY: optionalString,
  ADZUNA_COUNTRY: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().regex(/^[a-z]{2}$/).default("us")),
  REMOTIVE_ENABLED: z.preprocess((value) => blankToUndefined(value) === "true" || value === true, z.boolean()),
  JOB_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86_400).default(3600),
  JOB_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
  RESUME_MAX_BYTES: z.coerce.number().int().min(10_000).max(10_000_000).default(5_000_000),
});

// Cross-field rules. Messages name the setting, never its value.
const envSchema = baseEnvSchema.superRefine((value, ctx) => {
  const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

  if (Buffer.from(value.TOKEN_ENCRYPTION_KEY, "base64").length !== 32) {
    fail("TOKEN_ENCRYPTION_KEY", "must be base64 that decodes to exactly 32 bytes.");
  }

  if (value.LLM_PROVIDER === "openai-compatible") {
    if (!value.LLM_BASE_URL) fail("LLM_BASE_URL", "is required when LLM_PROVIDER is openai-compatible.");
    if (!value.LLM_MODEL) fail("LLM_MODEL", "is required when LLM_PROVIDER is openai-compatible.");
  }

  if (Boolean(value.ADZUNA_APP_ID) !== Boolean(value.ADZUNA_APP_KEY)) {
    fail("ADZUNA_APP_KEY", "ADZUNA_APP_ID and ADZUNA_APP_KEY must be set together.");
  }

  if (value.NODE_ENV === "production") {
    for (const key of ["FRONTEND_URL", "BACKEND_URL", "LLM_BASE_URL"] as const) {
      const url = value[key];
      if (url && new URL(url).protocol !== "https:") fail(key, "must use https in production.");
    }
  }
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BACKEND_URL: process.env.BACKEND_URL,
  MAX_REPOSITORIES_PER_ANALYSIS: process.env.MAX_REPOSITORIES_PER_ANALYSIS,
  MAX_REQUESTS_PER_REPOSITORY: process.env.MAX_REQUESTS_PER_REPOSITORY,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  JSEARCH_API_KEY: process.env.JSEARCH_API_KEY,
  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
  ADZUNA_COUNTRY: process.env.ADZUNA_COUNTRY,
  REMOTIVE_ENABLED: process.env.REMOTIVE_ENABLED,
  JOB_CACHE_TTL_SECONDS: process.env.JOB_CACHE_TTL_SECONDS,
  JOB_PROVIDER_TIMEOUT_MS: process.env.JOB_PROVIDER_TIMEOUT_MS,
  RESUME_MAX_BYTES: process.env.RESUME_MAX_BYTES,
});