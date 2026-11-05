import mongoose from "mongoose";
import { AnalysisModel } from "../models/analysis.model.js";
import { CareerProfileModel } from "../models/career-profile.model.js";
import { EvidenceModel } from "../models/evidence.model.js";
import { GapAnalysisModel } from "../models/gap-analysis.model.js";
import { RepositoryModel } from "../models/repository.model.js";
import { SavedJobModel } from "../models/saved-job.model.js";
import { UserModel } from "../models/user.model.js";

export type DeletedCounts = Record<string, number>;

// Removes everything NEXUS stores for one user. The user row (which holds the
// encrypted GitHub token) goes last, so a failure part-way leaves the account
// intact and the request can simply be repeated. This cannot revoke the OAuth
// grant at GitHub; the user does that in their GitHub settings.
export async function deleteAccountData(userId: string): Promise<DeletedCounts> {
  if (!mongoose.isValidObjectId(userId)) return {};

  const owner = { userId };
  const counts: DeletedCounts = {};

  counts.savedJobs = (await SavedJobModel.deleteMany(owner)).deletedCount;
  counts.careerProfile = (await CareerProfileModel.deleteMany(owner)).deletedCount;
  counts.gapAnalyses = (await GapAnalysisModel.deleteMany(owner)).deletedCount;
  counts.evidence = (await EvidenceModel.deleteMany(owner)).deletedCount;
  counts.analyses = (await AnalysisModel.deleteMany(owner)).deletedCount;
  counts.repositories = (await RepositoryModel.deleteMany(owner)).deletedCount;
  counts.user = (await UserModel.deleteOne({ _id: userId })).deletedCount;

  return counts;
}
