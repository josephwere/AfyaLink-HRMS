import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import { redis } from "../utils/redis.js";

let teardown;
const originalEnableRateLimitsInTests = process.env.ENABLE_RATE_LIMITS_IN_TESTS;

beforeAll(async () => {
  teardown = await setup();
});

afterEach(() => {
  if (originalEnableRateLimitsInTests === undefined) {
    delete process.env.ENABLE_RATE_LIMITS_IN_TESTS;
  } else {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = originalEnableRateLimitsInTests;
  }
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Distributed rate limiter", () => {
  test("fails open quickly when the limiter backend stalls", async () => {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = "1";

    const stallMs = 5000;
    const originalIncr = redis.incr;
    redis.incr = () => new Promise((resolve) => setTimeout(() => resolve(1), stallMs));

    try {
      const startedAt = Date.now();
      const res = await request(app)
        .post("/api/auth/login")
        .send({ identifier: "missing-user@afya.test", password: "WrongPass123!" });
      const elapsedMs = Date.now() - startedAt;

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(elapsedMs).toBeLessThan(3000);
    } finally {
      redis.incr = originalIncr;
    }
  });
});
