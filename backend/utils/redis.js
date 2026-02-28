import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const hasRedisConfig = Boolean(url && token);

function createMemoryRedisFallback() {
  const store = new Map();

  const now = () => Date.now();

  function cleanExpired(key) {
    if (!store.has(key)) return;
    const entry = store.get(key);
    if (entry?.expiresAt && entry.expiresAt <= now()) {
      store.delete(key);
    }
  }

  function getEntry(key) {
    cleanExpired(key);
    return store.get(key) || null;
  }

  function setEntry(key, value, ttlMs = null) {
    const expiresAt = Number.isFinite(ttlMs) && ttlMs > 0 ? now() + ttlMs : null;
    store.set(key, { value, expiresAt });
    if (expiresAt) {
      const timer = setTimeout(() => {
        cleanExpired(key);
      }, ttlMs);
      timer.unref?.();
    }
  }

  return {
    async get(key) {
      const entry = getEntry(key);
      return entry ? entry.value : null;
    },
    async set(key, value, ...args) {
      let ttlMs = null;
      if (args[0] && typeof args[0] === "object" && Number(args[0].ex) > 0) {
        ttlMs = Number(args[0].ex) * 1000;
      } else if (args[0] && typeof args[0] === "object" && Number(args[0].px) > 0) {
        ttlMs = Number(args[0].px);
      } else if (
        typeof args[0] === "string" &&
        args[0].toUpperCase() === "EX" &&
        Number(args[1]) > 0
      ) {
        ttlMs = Number(args[1]) * 1000;
      } else if (
        typeof args[0] === "string" &&
        args[0].toUpperCase() === "PX" &&
        Number(args[1]) > 0
      ) {
        ttlMs = Number(args[1]);
      }

      setEntry(key, value, ttlMs);
      return "OK";
    },
    async del(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      let removed = 0;
      for (const key of list) {
        cleanExpired(key);
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    async keys(pattern = "*") {
      const regex = new RegExp(
        `^${String(pattern)
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")}$`
      );
      const out = [];
      for (const key of store.keys()) {
        cleanExpired(key);
        if (store.has(key) && regex.test(key)) out.push(key);
      }
      return out;
    },
    async sadd(key, value) {
      const entry = getEntry(key);
      const set = entry?.value instanceof Set ? entry.value : new Set();
      set.add(value);
      setEntry(key, set, entry?.expiresAt ? Math.max(entry.expiresAt - now(), 1) : null);
      return 1;
    },
    async incr(key) {
      const entry = getEntry(key);
      const current = Number(entry?.value || 0);
      const next = current + 1;
      const ttlMs = entry?.expiresAt ? Math.max(entry.expiresAt - now(), 1) : null;
      setEntry(key, String(next), ttlMs);
      return next;
    },
    async expire(key, seconds) {
      const entry = getEntry(key);
      if (!entry) return 0;
      const ttlMs = Math.max(Number(seconds || 0), 0) * 1000;
      setEntry(key, entry.value, ttlMs);
      return 1;
    },
    async pexpire(key, ms) {
      const entry = getEntry(key);
      if (!entry) return 0;
      const ttlMs = Math.max(Number(ms || 0), 0);
      setEntry(key, entry.value, ttlMs);
      return 1;
    },
    async ttl(key) {
      const entry = getEntry(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      return Math.max(Math.ceil((entry.expiresAt - now()) / 1000), 0);
    },
    async pttl(key) {
      const entry = getEntry(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      return Math.max(entry.expiresAt - now(), 0);
    },
  };
}

export const redis = hasRedisConfig
  ? new Redis({ url, token })
  : createMemoryRedisFallback();
