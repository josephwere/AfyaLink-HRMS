const REQUIRED_IN_PROD = [
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "FRONTEND_URL",
  "CLAIM_SECRET_KEY",
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

  if (String(process.env.JWT_SECRET || "").length < 32) errors.push("JWT_SECRET must be at least 32 characters in production.");
  if (String(process.env.JWT_ACCESS_SECRET || "").length < 32) errors.push("JWT_ACCESS_SECRET must be at least 32 characters in production.");

  const claimSecret = String(process.env.CLAIM_SECRET_KEY || "");
  if (claimSecret && !/^[a-f0-9]{64}$/i.test(claimSecret)) {
    warnings.push("CLAIM_SECRET_KEY should be a 64-hex char key (32 bytes) for AES-256-GCM.");
  }

  const mongo = String(process.env.MONGO_URI || "");
  if (mongo.includes("127.0.0.1") || mongo.includes("localhost")) {
    warnings.push("MONGO_URI points to localhost in production mode.");
  }

  const frontend = String(process.env.FRONTEND_URL || "");
  if (frontend.startsWith("http://")) {
    warnings.push("FRONTEND_URL uses http:// in production mode.");
  }

  if (!process.env.CORS_ORIGIN) {
    warnings.push("CORS_ORIGIN is not configured. Explicit production origin allowlisting is recommended.");
  }

  if (!process.env.REDIS_URL && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) errors.push("Production requires REDIS_URL or the complete Upstash Redis configuration.");
  if (process.env.PPB_REGISTRY_URL && !process.env.PPB_API_KEY) errors.push("PPB_API_KEY is required when PPB_REGISTRY_URL is configured.");
  if (process.env.PPB_API_KEY && !process.env.PPB_REGISTRY_URL) errors.push("PPB_REGISTRY_URL is required when PPB_API_KEY is configured.");
  if (process.env.REDIS_URL && !/^rediss?:\/\//i.test(String(process.env.REDIS_URL))) errors.push("REDIS_URL must be a redis:// or rediss:// URL.");

  return { ok: errors.length === 0, errors, warnings, isProd };
}
