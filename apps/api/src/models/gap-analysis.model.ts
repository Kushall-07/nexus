import { Schema, model, type InferSchemaType } from "mongoose";

// Persisted Phase 7 role-match results. A scoring run (Analysis) is immutable
// and can be compared against any number of roles, so each role comparison is
// stored separately and points back at the scoring run whose Evidence Scores
// it used. `result` is the structured RoleMatchResult from the domain engine.
const gapAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    analysisId: { type: Schema.Types.ObjectId, ref: "Analysis", required: true },
    roleId: { type: String, required: true },
    scoringVersion: { type: String, required: true },
    roleCatalogVersion: { type: String, required: true },
    // SHA-256 of the validated role catalog that produced the result.
    roleCatalogHash: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "gap_analyses" },
);

gapAnalysisSchema.index({ userId: 1, createdAt: -1 });

export type GapAnalysisDocument = InferSchemaType<typeof gapAnalysisSchema>;

export const GapAnalysisModel = model("GapAnalysis", gapAnalysisSchema);
