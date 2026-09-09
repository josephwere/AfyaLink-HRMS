import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import { redis } from "../utils/redis.js";
import { createDistributedRateLimiter } from "../middleware/distributedRateLimiter.js";

let teardown;
const originalEnableRateLimitsInTests = process.env.ENABLE_RATE_LIMITS_IN_TESTS;

async function clearRateLimitKeys() {
  await redis.del(["auth:test:u:anon", "auth_sensitive:test:u:anon"]);
  await redis.set("auth_sensitive:test:u:anon", "0");
  for (const pattern of ["auth:*", "auth_sensitive:*"]) {
    const keys = await redis.keys(pattern);
    if (Array.isArray(keys) && keys.length > 0) {
      await redis.del(keys);
    }
  }
}

beforeAll(async () => {
  teardown = await setup();
  await clearRateLimitKeys();
});

afterEach(async () => {
  if (originalEnableRateLimitsInTests === undefined) {
    delete process.env.ENABLE_RATE_LIMITS_IN_TESTS;
  } else {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = originalEnableRateLimitsInTests;
  }
  await clearRateLimitKeys();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await clearRateLimitKeys();
  if (teardown) await teardown();
});

describe("Distributed rate limiter", () => {
  test("fails open quickly when the limiter backend stalls", async () => {
    process.env.ENABLE_RATE_LIMITS_IN_TESTS = "1";

    const stallMs = 5000;
    const originalIncr = redis.incr;
    redis.incr = () => new Promise((resolve) => setTimeout(() => resolve(1), stallMs));
    const limiter = createDistributedRateLimiter({
      prefix: "auth",
      windowMs: 60_000,
      max: 12,
      message: { message: "Too many requests. Please retry shortly.", code: "RATE_LIMITED" },
    });

    try {
      const startedAt = Date.now();
      let nextCalled = false;
      const req = {
        headers: {},
        ip: "127.0.0.1",
        connection: { remoteAddress: "127.0.0.1" },
        user: null,
      };
      const res = {
        setHeader: () => {},
        status: () => res,
        json: () => ({ ok: true }),
      };

      await limiter(req, res, () => {
        nextCalled = true;
      });

      const elapsedMs = Date.now() - startedAt;
      expect(nextCalled).toBe(true);
      expect(elapsedMs).toBeLessThan(2000);
      expect(elapsedMs).toBeLessThan(stallMs);
    } finally {
      redis.incr = originalIncr;
    }
  });
});
