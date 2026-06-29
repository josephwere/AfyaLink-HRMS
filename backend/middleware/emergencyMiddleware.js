import { redis } from "../utils/redis.js";

export async function emergencyResolver(req, _res, next) {
  try {
    const token = req.headers["x-emergency-token"] || req.headers["x-break-glass-token"];
    if (!token) return next();
    const key = `emergency:${token}`;
    const raw = await redis.get(key);
    if (!raw) return next();
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    req.emergencyOverride = {
      active: true,
      token,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      hospitalId: payload.hospitalId,
      reason: payload.reason,
      expiresAt: payload.expiresAt,
    };
    return next();
  } catch (err) {
    console.error("emergencyResolver error:", err.message);
    return next();
  }
}
