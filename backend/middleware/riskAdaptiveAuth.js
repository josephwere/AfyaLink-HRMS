import { redis } from "../utils/redis.js";
import { assessLoginRisk } from "../utils/sessionRisk.js";

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageMinutes(since) {
  if (!since) return Number.POSITIVE_INFINITY;
  return (Date.now() - since.getTime()) / (60 * 1000);
}

async function getStepUpTimestamp(req) {
  const fromToken = parseDate(req.tokenPayload?.stepUpVerifiedAt);
  if (fromToken) return fromToken;

  try {
    const raw = await redis.get(`stepup:last:${String(req.user?._id || "")}`);
    return parseDate(raw);
  } catch {
    return null;
  }
}

export const sessionRiskSummary = async (req, _res, next) => {
  if (!req.user) return next();

  const risk = assessLoginRisk(req, req.user);
  const stepUpAt = await getStepUpTimestamp(req);
  req.sessionRisk = {
    ...risk,
    stepUpVerifiedAt: stepUpAt,
    stepUpAgeMinutes: Number.isFinite(ageMinutes(stepUpAt))
      ? Math.max(0, Math.round(ageMinutes(stepUpAt)))
      : null,
  };
  next();
};

export const requireRecentStepUp = (maxAgeMinutes = 15) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const stepUpAt = await getStepUpTimestamp(req);
    const age = ageMinutes(stepUpAt);
    if (!stepUpAt || age > maxAgeMinutes) {
      return res.status(403).json({
        message: "Step-up authentication required",
        code: "STEP_UP_REQUIRED",
        maxAgeMinutes,
      });
    }
    return next();
  };
};

