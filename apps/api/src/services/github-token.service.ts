import { UserModel } from "../models/user.model.js";
import { decryptToken } from "../utils/token-encryption.js";
import { AppError, AuthErrorCode } from "../utils/errors.js";

// Resolves the authenticated user's GitHub access token for a single outbound
// request. The encrypted token is read from MongoDB (it is select:false by
// default) and decrypted only in backend memory; it must never be returned,
// logged, or persisted anywhere else by callers of this function.
export async function getDecryptedGithubToken(userId: string): Promise<string> {
  const user = await UserModel.findById(userId).select("+encryptedGithubToken");

  if (!user) {
    throw new AppError(
      AuthErrorCode.UNAUTHORIZED,
      401,
      "Session user no longer exists.",
    );
  }

  return decryptToken(user.encryptedGithubToken);
}
