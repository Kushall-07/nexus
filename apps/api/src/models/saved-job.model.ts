import { Schema, model } from "mongoose";

// A job the user saved, dismissed or is tracking. `job` is a bounded snapshot
// (description truncated) so the entry stays usable after the listing expires;
// provider content is never refreshed or redistributed from here.
const savedJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    jobId: { type: String, required: true, maxlength: 300 },
    job: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["saved", "planning", "applied", "interviewing", "offer", "rejected", "withdrawn"],
      default: "saved",
    },
    dismissed: { type: Boolean, default: false },
    note: { type: String, default: "", maxlength: 2000 },
    statusDate: { type: Date, default: null },
  },
  { timestamps: true, collection: "saved_jobs" },
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export const SavedJobModel = model("SavedJob", savedJobSchema);
