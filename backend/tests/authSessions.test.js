import request from "supertest";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import { MAX_ACTIVE_REFRESH_SESSIONS } from "../utils/authSessions.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Auth session storage", () => {
  test("caps active refresh sessions and records evictions", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Session Cap User", email: "session-cap@afya.test", password: "Pass123!" });

    for (let index = 0; index < MAX_ACTIVE_REFRESH_SESSIONS + 3; index += 1) {
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: "session-cap@afya.test", password: "Pass123!" });

      expect(login.status).toBe(200);
      expect(login.body.success).toBe(true);
      expect(login.body.refreshToken).toBeTruthy();
    }

    const user = await User.findOne({ email: "session-cap@afya.test" }).lean();
    expect(user.refreshTokens).toHaveLength(MAX_ACTIVE_REFRESH_SESSIONS);
    expect(user.sessionSecurity?.activeSessions || []).toHaveLength(MAX_ACTIVE_REFRESH_SESSIONS);
    expect((user.sessionSecurity?.revokedSessions || []).length).toBeGreaterThanOrEqual(3);
  });

  test("refresh rotation keeps the same bounded session record", async () => {
    const agent = request.agent(app);

    await agent
      .post("/api/auth/register")
      .send({ name: "Rotation User", email: "rotation@afya.test", password: "Pass123!" });

    const login = await agent
      .post("/api/auth/login")
      .send({ email: "rotation@afya.test", password: "Pass123!" });

    expect(login.status).toBe(200);
    expect(login.body.refreshToken).toBeTruthy();

    const before = await User.findOne({ email: "rotation@afya.test" }).lean();
    expect(before.refreshTokens).toHaveLength(1);
    expect(before.sessionSecurity?.activeSessions || []).toHaveLength(1);
    const initialSessionId = before.sessionSecurity?.activeSessions?.[0]?.sessionId;
    expect(initialSessionId).toBeTruthy();

    const refresh = await agent.post("/api/auth/refresh").send({});

    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).toBeTruthy();

    const after = await User.findOne({ email: "rotation@afya.test" }).lean();
    expect(after.refreshTokens).toHaveLength(1);
    expect(after.sessionSecurity?.activeSessions || []).toHaveLength(1);
    expect(after.sessionSecurity?.activeSessions?.[0]?.sessionId).toBe(initialSessionId);
    expect(after.sessionSecurity?.revokedSessions || []).toHaveLength(0);
  });
});
