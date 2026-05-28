// backend/controllers/refreshController.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { incrementMetricCounter } from "../utils/metrics.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "../utils/authCookies.js";
import { sanitizeString } from "../utils/securitySanitizers.js";
import { resolveSessionId, rotateRefreshSession } from "../utils/authSessions.js";

const REFRESH_DB_TIMEOUT_MS = Math.max(
  Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 5000) || 5000,
  1000
);

function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(timeoutMessage);
        error.code = "AUTH_BACKEND_TIMEOUT";
        reject(error);
      }, ms);
    }),
  ]);
}

/* ======================================================
   REFRESH ACCESS TOKEN
====================================================== */
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = sanitizeString(req.body?.refreshToken || req.cookies?.refreshToken || "", {
      maxLength: 4096,
    }).replace(/\s+/g, "");

    if (!refreshToken) {
      return res.status(401).json({ msg: "Refresh token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
    } catch {
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    const startedAtRaw = decoded?.sessionStartedAt || (decoded?.iat ? new Date(decoded.iat * 1000).toISOString() : null);
    const startedAtMs = startedAtRaw ? new Date(startedAtRaw).getTime() : NaN;
    const maxDays = Math.max(Number(process.env.JWT_MAX_SESSION_DAYS || 7), 1);
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(startedAtMs) || Date.now() - startedAtMs > maxAgeMs) {
      return res.status(401).json({ msg: "Session expired. Please login again." });
    }

    let user;
    try {
      user = await withTimeout(
        User.findById(decoded.id),
        REFRESH_DB_TIMEOUT_MS,
        `Refresh user lookup timed out for ${decoded.id}`
      );
    } catch (error) {
      console.error("Refresh user lookup error:", error.message);
      incrementMetricCounter(
        "afyalink_auth_backend_unavailable_total",
        { source: "refresh_lookup" },
        1,
        "Authentication requests blocked by backend dependency failures."
      );
      return res.status(503).json({
        msg: "Authentication is temporarily unavailable. Please try again.",
        code: "AUTH_BACKEND_UNAVAILABLE",
      });
    }
    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ msg: "User not found" });
    }

    if (user.active === false) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ msg: "Session expired. Please sign in again." });
    }

    if (!user.refreshTokens.includes(refreshToken)) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ msg: "Refresh token revoked" });
    }

    /* 🔄 Rotate refresh token */
    const sessionStartedAt = new Date(startedAtMs).toISOString();
    const sessionId = resolveSessionId(refreshToken, decoded?.sessionId || "");
    const newRefreshToken = signRefreshToken({
      id: user._id,
      sessionStartedAt,
      sessionId,
    });
    rotateRefreshSession(user, {
      previousRefreshToken: refreshToken,
      nextRefreshToken: newRefreshToken,
      sessionId,
      startedAt: sessionStartedAt,
      req,
      source: "REFRESH_ROTATION",
    });

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneVerified: user.phoneVerified,
      twoFactorVerified: true,
    });

    try {
      await withTimeout(
        user.save(),
        REFRESH_DB_TIMEOUT_MS,
        `Refresh session save timed out for ${decoded.id}`
      );
    } catch (error) {
      console.error("Refresh session save error:", error.message);
      incrementMetricCounter(
        "afyalink_auth_backend_unavailable_total",
        { source: "refresh_save" },
        1,
        "Authentication requests blocked by backend dependency failures."
      );
      return res.status(503).json({
        msg: "Authentication is temporarily unavailable. Please try again.",
        code: "AUTH_BACKEND_UNAVAILABLE",
      });
    }

    setRefreshTokenCookie(res, newRefreshToken);
    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    const status = err?.code === "AUTH_BACKEND_TIMEOUT" ? 503 : 500;
    if (status === 503) {
      incrementMetricCounter(
        "afyalink_auth_backend_unavailable_total",
        { source: "refresh_timeout" },
        1,
        "Authentication requests blocked by backend dependency failures."
      );
    }
    res.status(status).json({
      msg:
        status === 503
          ? "Authentication is temporarily unavailable. Please try again."
          : "Failed to refresh token",
      code: status === 503 ? "AUTH_BACKEND_UNAVAILABLE" : "",
    });
  }
};
