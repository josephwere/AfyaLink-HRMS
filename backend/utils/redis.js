import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const hasRedisConfig = Boolean(url && token);

function createMemoryRedisFallback() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, ...args) {
      // support common signatures:
      // set(key, value, { ex })
      // set(key, value, "EX", ttl)
      let ttlMs = null;
      if (args[0] && typeof args[0] === "object" && Number(args[0].ex) > 0) {
        ttlMs = Number(args[0].ex) * 1000;
      } else if (
        typeof args[0] === "string" &&
        args[0].toUpperCase() === "EX" &&
        Number(args[1]) > 0
      ) {
        ttlMs = Number(args[1]) * 1000;
      }

      store.set(key, value);
      if (ttlMs) {
        setTimeout(() => {
          store.delete(key);
        }, ttlMs).unref?.();
      }
      return "OK";
    },
    async del(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      let removed = 0;
      for (const key of list) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    async keys(pattern = "*") {
      if (pattern === "*") return Array.from(store.keys());
      const regex = new RegExp(
        `^${String(pattern)
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")}$`
      );
      return Array.from(store.keys()).filter((k) => regex.test(k));
    },
    async sadd(key, value) {
      const current = store.get(key);
      const set = current instanceof Set ? current : new Set();
      set.add(value);
      store.set(key, set);
      return 1;
    },
  };
}

export const redis = hasRedisConfig
  ? new Redis({ url, token })
  : createMemoryRedisFallback();
