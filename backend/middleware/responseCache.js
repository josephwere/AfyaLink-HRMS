import { cacheGet, cacheSet } from "../utils/cache.js";

function appendVary(res, values = []) {
  const current = String(res.getHeader("Vary") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const next = new Set([...current, ...values.filter(Boolean)]);
  if (next.size) {
    res.setHeader("Vary", Array.from(next).join(", "));
  }
}

function defaultCacheKey(req) {
  const userId = String(req.user?._id || req.user?.id || "anon");
  const role = String(req.user?.role || "anon");
  const hospital = String(req.user?.hospital || "none");
  const impersonatedRole = String(
    req.headers["x-afya-view-role"] || req.headers["x-afyalink-view-role"] || ""
  ).trim();
  const query = new URLSearchParams(req.query || {}).toString();
  const base = req.baseUrl || "";
  const path = req.path || req.originalUrl || "";
  return [
    "response-cache",
    base,
    path,
    query,
    userId,
    role,
    hospital,
    impersonatedRole || "direct",
  ].join(":");
}

function resolveCacheControl(ttlSeconds) {
  const safeTtl = Math.max(Number(ttlSeconds) || 0, 0);
  return `private, max-age=0, s-maxage=${safeTtl}, stale-while-revalidate=${safeTtl}`;
}

export function cacheJsonResponse({ ttlSeconds = 15, key = defaultCacheKey } = {}) {
  return async function responseCacheMiddleware(req, res, next) {
    if (!["GET", "HEAD"].includes(String(req.method || "").toUpperCase())) {
      return next();
    }

    const requestCacheControl = String(req.headers["cache-control"] || "").toLowerCase();
    if (requestCacheControl.includes("no-cache") || String(req.query?.refresh || "") === "1") {
      res.setHeader("X-Afya-Response-Cache", "BYPASS");
      return next();
    }

    const ttl = Math.max(
      Number(typeof ttlSeconds === "function" ? ttlSeconds(req) : ttlSeconds) || 0,
      0
    );
    if (!ttl) return next();

    const cacheKey = typeof key === "function" ? key(req) : key;
    if (!cacheKey) return next();

    appendVary(res, [
      "Authorization",
      "Cookie",
      "X-Afya-View-Role",
      "X-AfyaLink-View-Role",
    ]);
    res.setHeader("Cache-Control", resolveCacheControl(ttl));

    try {
      const cached = await cacheGet(cacheKey);
      if (cached !== null && cached !== undefined) {
        res.setHeader("X-Afya-Response-Cache", "HIT");
        return res.json(cached);
      }
    } catch {
      // Fall through to the live handler when cache lookup fails.
    }

    res.setHeader("X-Afya-Response-Cache", "MISS");
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(cacheKey, body, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    return next();
  };
}
