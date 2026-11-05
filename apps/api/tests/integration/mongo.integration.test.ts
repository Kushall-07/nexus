import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../../src/app.js";
import { SESSION_COOKIE_NAME } from "../../src/config/auth.config.js";
import { CareerProfileModel } from "../../src/models/career-profile.model.js";
import { RevokedSessionModel } from "../../src/models/revoked-session.model.js";
import { SavedJobModel } from "../../src/models/saved-job.model.js";
import { UserModel } from "../../src/models/user.model.js";
import { connectDatabase, disconnectDatabase } from "../../src/services/database.js";
import { createSessionToken } from "../../src/services/session.service.js";

async function makeUser(githubId: string) {
  const user = await UserModel.create({ githubId, username: `user-${githubId}`, encryptedGithubToken: "not-a-real-token" });
  const id = String(user._id);
  const cookie = `${SESSION_COOKIE_NAME}=${createSessionToken({ sub: id, githubId })}`;
  await SavedJobModel.create({ userId: id, jobId: `job-${githubId}`, job: { title: "Engineer" } });
  await CareerProfileModel.create({ userId: id });
  return { id, cookie, githubId };
}

describe("MongoDB-backed behaviour (real database)", () => {
  beforeAll(async () => {
    await connectDatabase();
    await Promise.all([SavedJobModel.init(), CareerProfileModel.init(), RevokedSessionModel.init(), UserModel.init()]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });

  it("reports readiness once connected", async () => {
    const response = await request(app).get("/ready");
    expect(response.status).toBe(200);
  });

  it("enforces one saved-job row per user and job", async () => {
    const user = await makeUser("dup-1");
    await expect(SavedJobModel.create({ userId: user.id, jobId: "job-dup-1", job: {} })).rejects.toThrow(/duplicate key/i);
  });

  it("DELETE /api/auth/account requires the exact confirmation phrase", async () => {
    const user = await makeUser("confirm-1");
    const missing = await request(app).delete("/api/auth/account").set("Cookie", user.cookie).send({});
    const wrong = await request(app).delete("/api/auth/account").set("Cookie", user.cookie).send({ confirmation: "yes" });
    const anonymous = await request(app).delete("/api/auth/account").send({ confirmation: "DELETE MY DATA" });

    expect(missing.status).toBe(422);
    expect(wrong.status).toBe(422);
    expect(anonymous.status).toBe(401);
    expect(await UserModel.countDocuments({ githubId: "confirm-1" })).toBe(1);
  });

  it("deletes only the caller's data and invalidates their session", async () => {
    const victim = await makeUser("delete-a");
    const bystander = await makeUser("delete-b");

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Cookie", victim.cookie)
      .send({ confirmation: "DELETE MY DATA" });

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toMatchObject({ user: 1, savedJobs: 1, careerProfile: 1 });
    expect(await UserModel.countDocuments({ _id: victim.id })).toBe(0);
    expect(await SavedJobModel.countDocuments({ userId: victim.id })).toBe(0);
    expect(await CareerProfileModel.countDocuments({ userId: victim.id })).toBe(0);

    expect(await UserModel.countDocuments({ _id: bystander.id })).toBe(1);
    expect(await SavedJobModel.countDocuments({ userId: bystander.id })).toBe(1);

    const reuse = await request(app).get("/api/auth/me").set("Cookie", victim.cookie);
    expect(reuse.status).toBe(401);
  });

  it("keeps a logged-out session revoked after a process restart", async () => {
    const user = await makeUser("logout-1");

    const logout = await request(app).post("/api/auth/logout").set("Cookie", user.cookie);
    expect(logout.status).toBe(200);
    expect(await RevokedSessionModel.countDocuments()).toBeGreaterThan(0);

    // A fresh module instance has an empty in-memory set, like a restarted process.
    vi.resetModules();
    mongoose.deleteModel("RevokedSession");
    const fresh = await import("../../src/services/session.service.js");
    const token = user.cookie.slice(SESSION_COOKIE_NAME.length + 1);
    expect(() => fresh.verifySessionToken(token)).not.toThrow();
    await fresh.loadRevokedSessions();
    expect(() => fresh.verifySessionToken(token)).toThrow(/revoked/i);
  });
});
