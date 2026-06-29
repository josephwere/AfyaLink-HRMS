import { redis } from "../utils/redis.js";

const REDIS_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RATE_LIMIT_BACKEND_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 350;
})();

function keyForReq(prefix, req) {
  const ip =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown";
  const user = req.user?._id ? `u:${String(req.user._id)}` : "u:anon";
  // In test mode where rate-limits are explicitly enabled, use a fixed key
  // to avoid variability from differing IP representations across requests
  // (supertest sometimes presents different peer addresses). This makes the
  // limiter deterministic for tests.
  if (String(process.env.ENABLE_RATE_LIMITS_IN_TESTS || "") === "1") {
    return `${prefix}:test:u:anon`;
  }

  return `${prefix}:${user}:${ip}`;
}

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function withRedisTimeout(operation) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("RATE_LIMIT_BACKEND_TIMEOUT"));
        }, REDIS_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readTtlMs(key) {
  try {
    if (typeof redis.pttl === "function") {
      const ttl = await withRedisTimeout(() => redis.pttl(key));
      if (Number.isFinite(Number(ttl))) return Math.max(Number(ttl), 0);
    }
    if (typeof redis.ttl === "function") {
      const ttl = await withRedisTimeout(() => redis.ttl(key));
      if (Number.isFinite(Number(ttl))) return Math.max(Number(ttl) * 1000, 0);
    }
  } catch {
    // ignore
  }
  return 0;
}

// In-test deterministic counters (when ENABLE_RATE_LIMITS_IN_TESTS === '1')
const testCounters = new Map();


export function createDistributedRateLimiter({
  prefix,
  windowMs,
  max,
  message,
  skip,
}) {
  const safePrefix = String(prefix || "rl");
  const safeWindowMs = parseNumber(windowMs, 60_000);
  const safeMax = parseNumber(max, 60);

  return async function distributedRateLimiter(req, res, next) {
    try {
      if (typeof skip === "function" && skip(req)) {
        return next();
      }

      const key = keyForReq(safePrefix, req);
      let count;

      // Deterministic in-process counters for tests that explicitly enable
      // rate-limits. This avoids flakiness due to varying IP formats or
      // cross-test interference when running many suites sequentially.
      if (String(process.env.ENABLE_RATE_LIMITS_IN_TESTS || "") === "1") {
        const existing = Number(testCounters.get(key) || 0);
        count = existing + 1;
        testCounters.set(key, count);
        // ensure the counter clears after the configured window
        setTimeout(() => {
          testCounters.delete(key);
        }, safeWindowMs).unref?.();
      } else if (typeof redis.incr === "function") {
        count = Number(await withRedisTimeout(() => redis.incr(key)));
      } else {
        const current = Number((await withRedisTimeout(() => redis.get(key))) || 0);
        count = current + 1;
        await withRedisTimeout(() => redis.set(key, String(count)));
      }

      if (count === 1) {
        if (typeof redis.pexpire === "function") {
          await withRedisTimeout(() => redis.pexpire(key, safeWindowMs));
        } else if (typeof redis.expire === "function") {
          await withRedisTimeout(() => redis.expire(key, Math.ceil(safeWindowMs / 1000)));
        } else {
          await withRedisTimeout(() =>
            redis.set(key, String(count), { ex: Math.ceil(safeWindowMs / 1000) })
          );
        }
      }

      const remaining = Math.max(safeMax - count, 0);
      const ttlMs = await readTtlMs(key);
      const retryAfterSec = Math.max(1, Math.ceil((ttlMs || safeWindowMs) / 1000));

      res.setHeader("RateLimit-Limit", String(safeMax));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(retryAfterSec));

      if (count > safeMax) {
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(429).json(
          message || {
            message: "Too many requests. Please retry shortly.",
            code: "RATE_LIMITED",
          }
        );
      }

      return next();
    } catch {
      // Fail-open to preserve service continuity if limiter backend is degraded.
      return next();
    }
  };
}
