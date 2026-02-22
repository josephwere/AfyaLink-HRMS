const REQUIRED_IN_PROD = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "FRONTEND_URL",
];

const WEAK_VALUES = new Set([
  "",
  "replace_me",
  "changeme",
  "change-me",
  "secret",
  "test",
  "testsecret",
]);

function isWeak(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return WEAK_VALUES.has(normalized);
}

export function validateRuntimeEnv({ mode = process.env.NODE_ENV } = {}) {
  const isProd = String(mode || "").toLowerCase() === "production";
  const errors = [];
  const warnings = [];

  if (!isProd) {
    return { ok: true, errors, warnings, isProd };
  }

  for (const key of REQUIRED_IN_PROD) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  if (isWeak(process.env.JWT_SECRET)) {
    errors.push("JWT_SECRET is weak/default. Use a long random secret.");
  }
  if (isWeak(process.env.JWT_ACCESS_SECRET)) {
    errors.push("JWT_ACCESS_SECRET is weak/default. Use a long random secret.");
  }

  const mongo = String(process.env.MONGO_URI || "");
  if (mongo.includes("127.0.0.1") || mongo.includes("localhost")) {
    warnings.push("MONGO_URI points to localhost in production mode.");
  }

  const frontend = String(process.env.FRONTEND_URL || "");
  if (frontend.startsWith("http://")) {
    warnings.push("FRONTEND_URL uses http:// in production mode.");
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    warnings.push("Redis not configured. Realtime/queue coordination may be degraded.");
  }

  return { ok: errors.length === 0, errors, warnings, isProd };
}

