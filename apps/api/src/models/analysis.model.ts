import { Schema, model, type InferSchemaType } from "mongoose";

// Persisted Phase 5 scoring runs ("analyses"). One document is the complete,
// reproducible result of scoring one user's evidence: it records which
// repositories and how much evidence went in, which scoring version and
// configuration produced it, and the full structured ScoringResult (including
// every per-signal and per-contribution breakdown).
const analysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    scoringVersion: { type: String, required: true },
    // SHA-256 of the canonical scoring configuration that produced the result.
    scoringConfigHash: { type: String, required: true },
    repositoryIds: [{ type: Schema.Types.ObjectId, ref: "Repository" }],
    evidenceCount: { type: Number, required: true, min: 0 },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "analyses" },
);

analysisSchema.index({ userId: 1, createdAt: -1 });

export type AnalysisDocument = InferSchemaType<typeof analysisSchema>;

export const AnalysisModel = model("Analysis", analysisSchema);
