import { UserModel } from "../models/user.model.js";
import { encryptToken } from "../utils/token-encryption.js";
import type { GithubIdentity } from "./github-oauth.service.js";

export interface SafeUser {
  id: string;
  githubId: string;
  username: string;
}

export async function upsertUserFromGithub(
  identity: GithubIdentity,
  accessToken: string,
): Promise<SafeUser> {
  const encryptedGithubToken = encryptToken(accessToken);

  const user = await UserModel.findOneAndUpdate(
    { githubId: identity.githubId },
    { username: identity.username, encryptedGithubToken },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    id: user._id.toString(),
    githubId: user.githubId,
    username: user.username,
  };
}

export async function findSafeUserById(id: string): Promise<SafeUser | null> {
  const user = await UserModel.findById(id);

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    githubId: user.githubId,
    username: user.username,
  };
}
