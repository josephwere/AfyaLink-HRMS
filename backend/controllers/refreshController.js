// backend/controllers/refreshController.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "../utils/authCookies.js";
import { sanitizeString } from "../utils/securitySanitizers.js";
import { resolveSessionId, rotateRefreshSession } from "../utils/authSessions.js";

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

    const user = await User.findById(decoded.id);
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

    await user.save();

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
    res.status(500).json({ msg: "Failed to refresh token" });
  }
};
