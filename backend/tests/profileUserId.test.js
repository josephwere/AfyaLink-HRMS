import request from "supertest";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";

let teardown;
beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("profile user ID visibility", () => {
  test("/api/auth/me and /api/profile return the userId for authenticated users", async () => {
    const user = await User.create({
      name: "Profile User",
      email: "profile-user@afya.test",
      password: "Pass123!",
      role: "PATIENT",
    });

    const tokenRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "profile-user@afya.test", password: "Pass123!" });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.user?.userId).toBeTruthy();

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.userId || meRes.body.user?.userId || meRes.body.userId).toBeTruthy();

    const profileRes = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${tokenRes.body.accessToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.userId).toBeTruthy();

    const refreshedUser = await User.findById(user._id).lean();
    expect(refreshedUser.userId).toBeTruthy();
  });
});
