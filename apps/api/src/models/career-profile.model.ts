import { Schema, model } from "mongoose";

// One document per user holding career preferences, the ACTIVE resume profile
// (normalized fields only, never the uploaded file or its raw text), learning
// progress and GitHub refresh status. Sub-documents are validated with zod in
// the career store before they are written.
// New collection: existing users and collections are unaffected.
const careerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    preferences: { type: Schema.Types.Mixed, default: () => ({}) },
    resume: { type: Schema.Types.Mixed, default: null },
    learning: {
      direction: { type: String, default: null },
      tasks: { type: Schema.Types.Mixed, default: () => ({}) },
    },
    refresh: {
      status: { type: String, enum: ["idle", "running", "succeeded", "failed"], default: "idle" },
      lastAttemptAt: { type: Date, default: null },
      lastSuccessAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },
  },
  { timestamps: true, collection: "career_profiles", minimize: false },
);

export const CareerProfileModel = model("CareerProfile", careerProfileSchema);
