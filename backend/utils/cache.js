import Redis from "ioredis";

/* ================= REDIS CLIENT ================= */

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
  redis.on("error", (err) => {
    console.error("Redis error:", err.message);
  });
}

/* ================= MEMORY FALLBACK ================= */

const memoryCache = new Map();

/* ================= HELPERS ================= */

export const cacheGet = async (key) => {
  try {
    if (redis) {
      const value = await redis.get(key);
      if (value) return JSON.parse(value);
    }
  } catch {}

  return memoryCache.get(key) || null;
};

export const cacheSet = async (key, value, ttl = 300) => {
  try {
    if (redis) {
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return;
    }
  } catch {}

  memoryCache.set(key, value);

  setTimeout(() => {
    memoryCache.delete(key);
  }, ttl * 1000);
};

export const cacheDel = async (pattern) => {
  try {
    if (redis) {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(keys);
    }
  } catch {}

  for (const key of memoryCache.keys()) {
    if (key.startsWith(pattern.replace("*", ""))) {
      memoryCache.delete(key);
    }
  }
};
