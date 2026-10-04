import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: new URL("../../../../.env", import.meta.url),
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(4000),

  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(32),

  GITHUB_CLIENT_ID: z.string().min(1),

  GITHUB_CLIENT_SECRET: z.string().min(1),

  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  FRONTEND_URL: z.string().url(),

  BACKEND_URL: z.string().url(),
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
});