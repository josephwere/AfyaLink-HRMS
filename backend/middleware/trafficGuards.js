import { createDistributedRateLimiter } from "./distributedRateLimiter.js";

const parseMs = (v, fallback) => {
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const parseCount = (v, fallback) => {
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

export const authLimiter = createDistributedRateLimiter({
  prefix: "auth",
  windowMs: parseMs(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 60 * 1000),
  max: parseCount(process.env.RATE_LIMIT_AUTH_MAX, 60),
  message: {
    message: "Too many auth requests. Please retry shortly.",
    code: "AUTH_RATE_LIMITED",
  },
  skip: (req) => String(req.path || "").includes("/refresh"),
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
