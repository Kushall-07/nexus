import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Fail fast with a clear error instead of waiting the 30s driver default.
  // maxPoolSize: 50 replaces the default of 5, which exhausts under real concurrent load.
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 50 });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}