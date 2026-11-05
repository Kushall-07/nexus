import { RepositoryModel } from "../models/repository.model.js";
import { analyzeSelectedRepository } from "../services/github-analysis.service.js";
import { getDecryptedGithubToken } from "../services/github-token.service.js";
import { scoreUserEvidence } from "../services/scoring.service.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";
import { setRefreshState } from "./career-store.js";

// Coordinates the EXISTING analysis and scoring services; it contains no
// analysis or scoring logic of its own and uses only the user's existing
// (public-repository) GitHub grant. Scoring writes a new immutable Analysis
// only after every selected repository was analysed, so a failed refresh
// leaves the last known good profile as the latest analysis.

export interface RefreshResult {
  status: "succeeded" | "failed";
  analyzedCount: number;
  skippedCount: number; // repositories GitHub no longer exposes
  failedCount: number;
  analysisId: string | null;
  message: string;
  profileIsStale: boolean;
}

const inFlight = new Set<string>();
const GONE_CODES: string[] = [AuthErrorCode.GITHUB_NOT_FOUND, AuthErrorCode.REPOSITORY_NOT_FOUND];

export async function refreshGithubProfile(userId: string): Promise<RefreshResult> {
  if (inFlight.has(userId)) {
    throw new AppError(AuthErrorCode.REFRESH_IN_PROGRESS, 409, "A refresh is already running.");
  }
  inFlight.add(userId);

  const attemptedAt = new Date();
  await setRefreshState(userId, { status: "running", lastAttemptAt: attemptedAt, lastError: null });

  const fail = async (message: string, counts: Partial<RefreshResult>): Promise<RefreshResult> => {
    await setRefreshState(userId, { status: "failed", lastError: message });
    return {
      status: "failed",
      analyzedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      analysisId: null,
      ...counts,
      message,
      profileIsStale: true,
    };
  };

  try {
    const repositories = await RepositoryModel.find({ userId, selected: true }).lean();

    if (repositories.length === 0) {
      return await fail("Select at least one repository before refreshing.", {});
    }

    const accessToken = await getDecryptedGithubToken(userId);
    let analyzedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const repository of repositories) {
      try {
        await analyzeSelectedRepository(userId, String(repository._id), accessToken);
        analyzedCount += 1;
      } catch (error) {
        if (error instanceof AppError && GONE_CODES.includes(error.code)) {
          skippedCount += 1;
        } else if (error instanceof AppError && error.code === AuthErrorCode.GITHUB_RATE_LIMIT) {
          // Stop early: more requests would only fail.
          return await fail("GitHub rate limit reached. Your previous analysis is still shown; try again later.", {
            analyzedCount,
            skippedCount,
            failedCount: repositories.length - analyzedCount - skippedCount,
          });
        } else {
          failedCount += 1;
          console.error("Profile refresh: repository analysis failed:", error instanceof AppError ? error.code : "UNKNOWN");
        }
      }
    }

    if (failedCount > 0 || analyzedCount === 0) {
      return await fail(
        analyzedCount === 0
          ? "No selected repository could be analyzed. Your previous analysis is still shown."
          : `${failedCount} repositor${failedCount === 1 ? "y" : "ies"} could not be analyzed. Your previous analysis is still shown.`,
        { analyzedCount, skippedCount, failedCount },
      );
    }

    const scored = await scoreUserEvidence(userId);
    await setRefreshState(userId, { status: "succeeded", lastSuccessAt: new Date(), lastError: null });

    return {
      status: "succeeded",
      analyzedCount,
      skippedCount,
      failedCount: 0,
      analysisId: scored.analysisId,
      message:
        skippedCount > 0
          ? `Profile refreshed. ${skippedCount} repositor${skippedCount === 1 ? "y is" : "ies are"} no longer accessible and ${skippedCount === 1 ? "was" : "were"} skipped.`
          : "Profile refreshed.",
      profileIsStale: false,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === AuthErrorCode.REFRESH_IN_PROGRESS) throw error;
    const message =
      error instanceof AppError && error.code === AuthErrorCode.GITHUB_TOKEN_EXPIRED
        ? "Your GitHub session expired. Sign in again to refresh."
        : "The refresh could not be completed. Your previous analysis is still shown.";
    console.error("Profile refresh failed:", error instanceof AppError ? error.code : "UNKNOWN");
    return await fail(message, {});
  } finally {
    inFlight.delete(userId);
  }
}
