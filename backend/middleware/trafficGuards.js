import { createDistributedRateLimiter } from "./distributedRateLimiter.js";

const parseMs = (v, fallback) => {
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const parseCount = (v, fallback) => {
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const shouldBypassRateLimitsInTests = () =>
  (process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID)) &&
  process.env.ENABLE_RATE_LIMITS_IN_TESTS !== "1";

export const authLimiter = createDistributedRateLimiter({
  prefix: "auth",
  windowMs: parseMs(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 60 * 1000),
  max: parseCount(process.env.RATE_LIMIT_AUTH_MAX, 60),
  message: {
    message: "Too many auth requests. Please retry shortly.",
    code: "AUTH_RATE_LIMITED",
  },
  // Do not apply the general auth limiter to endpoints that are protected
  // by the sensitive limiter so the stricter policy takes precedence.
  skip: (req) => {
    // In test mode where ENABLE_RATE_LIMITS_IN_TESTS=1 we want the sensitive
    // limiter to be the only limiter exercising auth endpoints. Disable the
    // generic authLimiter entirely in that case to avoid nondeterministic
    // ordering between limiters.
    if (String(process.env.ENABLE_RATE_LIMITS_IN_TESTS || "") === "1") return true;
    if (shouldBypassRateLimitsInTests()) return true;
    const path = String(req.path || "");
    if (path.includes("/refresh")) return true;
    const sensitivePaths = ["/login", "/register", "/forgot-password", "/reset-password", "/2fa", "/phone", "/resend-verification"];
    return sensitivePaths.some((p) => path.includes(p));
  },
});

export const authSensitiveLimiter = createDistributedRateLimiter({
  prefix: "auth_sensitive",
  windowMs: parseMs(process.env.RATE_LIMIT_AUTH_SENSITIVE_WINDOW_MS, 5 * 60 * 1000),
  max: parseCount(process.env.RATE_LIMIT_AUTH_SENSITIVE_MAX, 12),
  message: {
    message: "Too many sign-in or recovery attempts. Wait a few minutes and try again.",
    code: "AUTH_SENSITIVE_RATE_LIMITED",
  },
  skip: () => shouldBypassRateLimitsInTests(),
});

export const aiGatewayLimiter = createDistributedRateLimiter({
  prefix: "ai_gateway",
  windowMs: parseMs(process.env.RATE_LIMIT_AI_WINDOW_MS, 60 * 1000),
  max: parseCount(process.env.RATE_LIMIT_AI_MAX, 240),
  message: {
    message: "AI gateway temporarily throttled. Please retry shortly.",
    code: "AI_RATE_LIMITED",
  },
});
