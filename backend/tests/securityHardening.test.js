import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import { redis } from "../utils/redis.js";

let teardown;
const originalNodeEnv = process.env.NODE_ENV;
const originalEnableRateLimitsInTests = process.env.ENABLE_RATE_LIMITS_IN_TESTS;

function signToken(userId) {
  return jwt.sign(
    { id: String(userId), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
}

async function clearRateLimitKeys() {
  const patterns = ["auth:*", "auth_sensitive:*"];
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (Array.isArray(keys) && keys.length > 0) {
      await redis.del(keys);
    }
  }
}

beforeAll(async () => {
  teardown = await setup();
});

afterEach(async () => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalEnableRateLimitsInTests === undefined) {
    delete process.env.ENABLE_RATE_LIMITS_IN_TESTS;
  } else {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = originalEnableRateLimitsInTests;
  }
  await clearRateLimitKeys();
});

afterAll(async () => {
  await clearRateLimitKeys();
  if (teardown) await teardown();
});

describe("Security hardening", () => {
  test("exports account data without refresh tokens or 2FA secrets", async () => {
    const user = await User.create({
      name: "Export User",
      email: "export-user@afya.test",
      password: "Pass123!",
      role: "PATIENT",
      emailVerified: true,
      phoneVerified: true,
      refreshTokens: ["stale-refresh-token"],
      trustedDevices: [
        {
          deviceId: "device-1",
          userAgent: "Jest Browser",
          lastIp: "127.0.0.1",
        },
      ],
      twoFactorEnabled: true,
    });

    const res = await request(app)
      .get("/api/profile/export")
      .set("Authorization", `Bearer ${signToken(user._id)}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("afyalink-account-export");

    const payload = JSON.parse(res.text);
    expect(payload.account.email).toBe("export-user@afya.test");
    expect(payload.account.refreshTokens).toBeUndefined();
    expect(payload.account.twoFactorSecret).toBeUndefined();
    expect(payload.account.twoFactorTempSecret).toBeUndefined();
    expect(Array.isArray(payload.account.trustedDevices)).toBe(true);
    expect(payload.account.trustedDevices).toHaveLength(1);
  });

  test("delete-account deactivates the user and scrubs sensitive login remnants", async () => {
    const user = await User.create({
      name: "Delete Me",
      email: "delete-me@afya.test",
      password: "Pass123!",
      role: "PATIENT",
      refreshTokens: ["refresh-a", "refresh-b"],
      trustedDevices: [
        {
          deviceId: "device-delete",
          userAgent: "Delete Browser",
          lastIp: "127.0.0.1",
        },
      ],
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: ["abc123"],
    });

    const res = await request(app)
      .post("/api/profile/delete-account")
      .set("Authorization", `Bearer ${signToken(user._id)}`)
      .send({
        confirmText: "DELETE MY ACCOUNT",
        currentPassword: "Pass123!",
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Account deleted/i);

    const stored = await User.findById(user._id).select(
      "+password +resetPasswordToken +resetPasswordExpires +resetPasswordRequestedAt +twoFactorSecret +twoFactorTempSecret"
    );
    expect(stored.active).toBe(false);
    expect(stored.name).toBe("Deleted user");
    expect(stored.email).toBeUndefined();
    expect(stored.phone).toBeUndefined();
    expect(stored.refreshTokens).toHaveLength(0);
    expect(stored.password).toBeUndefined();
    expect(stored.trustedDevices).toHaveLength(0);
    expect(stored.metadata.accountDeletedBySelf).toBe(true);

    const oldTokenRequest = await request(app)
      .get("/api/profile/export")
      .set("Authorization", `Bearer ${signToken(user._id)}`);
    expect(oldTokenRequest.status).toBe(401);
  });

  test("production API requests reject insecure transport and set HSTS on forwarded HTTPS", async () => {
    process.env.NODE_ENV = "production";

    const insecure = await request(app)
      .post("/api/auth/refresh")
      .set("Host", "example.com")
      .send({});

    expect(insecure.status).toBe(426);
    expect(insecure.body.code).toBe("HTTPS_REQUIRED");

    const secure = await request(app)
      .post("/api/auth/refresh")
      .set("Host", "example.com")
      .set("X-Forwarded-Proto", "https")
      .send({});

    expect(secure.status).toBe(401);
    expect(secure.headers["strict-transport-security"]).toContain("max-age=");
  });

  test("sensitive auth endpoints return a rate-limit response when attempts exceed the configured window", async () => {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = "1";
    await clearRateLimitKeys();

    let finalResponse = null;
    for (let attempt = 0; attempt < 13; attempt += 1) {
      finalResponse = await request(app)
        .post("/api/auth/login")
        .send({ identifier: "missing-user@afya.test", password: "WrongPass123!" });
    }

    expect(finalResponse.status).toBe(429);
    expect(finalResponse.body.code).toBe("AUTH_SENSITIVE_RATE_LIMITED");
  });
});
