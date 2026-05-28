// backend/middleware/authMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
import { isPrivilegedOverrideAllowed, isReadOnlyOverrideAllowed } from "./readOnlyOverride.js";
import { resolveEffectiveRole } from "./effectiveRole.js";
import { redis } from "../utils/redis.js";
import { HOSPITAL_SCOPED_ROLES } from "../utils/roleSets.js";

dotenv.config();

const AUTH_LOOKUP_TIMEOUT_MS = Math.max(
  Number(process.env.AUTH_LOOKUP_TIMEOUT_MS || 5000) || 5000,
  1000
);
const AUTH_REDIS_TIMEOUT_MS = Math.max(
  Number(process.env.AUTH_REDIS_TIMEOUT_MS || 900) || 900,
  250
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

function isJwtError(error) {
  return (
    error?.name === "TokenExpiredError" ||
    error?.name === "JsonWebTokenError" ||
    error?.name === "NotBeforeError"
  );
}

function authBackendUnavailable(res) {
  return res.status(503).json({
    message: "Authentication is temporarily unavailable. Please try again.",
    code: "AUTH_BACKEND_UNAVAILABLE",
  });
}

function verifyAccessToken(token) {
  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_SECRET,
  ].filter(Boolean);

  let lastError = null;
  for (const secret of [...new Set(secrets)]) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new jwt.JsonWebTokenError("Invalid token");
}

async function safeRedisGet(key) {
  try {
    return await withTimeout(
      redis.get(key),
      AUTH_REDIS_TIMEOUT_MS,
      `Redis auth lookup timed out for ${key}`
    );
  } catch {
    return null;
  }
}

/* ======================================================
   ROLE HIERARCHY (HIGH → LOW)
====================================================== */
const ROLE_PRIORITY = {
  SUPER_ADMIN: 100,
  SUPER_ASSISTANT: 95,
  SYSTEM_ADMIN: 90,
  GOVERNMENT_ADMIN: 5,
  GOVERNMENT_REGULATOR: 5,
  GOVERNMENT_AUDITOR: 5,
  GOVERNMENT_INSPECTOR: 5,
  GOVERNMENT_ANALYST: 5,
  HOSPITAL_ADMIN: 80,
  HOSPITAL_ADMIN_ASSISTANT: 70,
  DOCTOR: 60,
  SURGEON: 60,
  NURSE: 60,
  LAB_TECH: 60,
  PHARMACIST: 60,
  HR_MANAGER: 60,
  PAYROLL_OFFICER: 60,
  COMMUNITY_HEALTH_WORKER: 50,
  DEVELOPER: 30,
  PATIENT: 10,
  GUEST: 0,
};

/* ======================================================
   AUTHENTICATION (JWT + 2FA ENFORCEMENT)
====================================================== */
const authenticate = async (req, res, next) => {
  try {
    let token;

    // Authorization header or cookie
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = verifyAccessToken(token);

    let user;
    try {
      user = await withTimeout(
        User.findById(decoded.id).select("-password"),
        AUTH_LOOKUP_TIMEOUT_MS,
        `Auth user lookup timed out for ${decoded.id}`
      );
    } catch (error) {
      if (isJwtError(error)) throw error;
      console.error("Auth user lookup error:", error.message);
      return authBackendUnavailable(res);
    }
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.active === false) {
      return res.status(401).json({ message: "Account inactive" });
    }

    const actualRole = user.role;
    let effectiveRole = resolveEffectiveRole(req, actualRole);
    // Prevent "empty data" incidents: hospital-scoped impersonation without hospital context
    // can force null/invalid tenant filters and hide existing data.
    if (
      effectiveRole !== actualRole &&
      HOSPITAL_SCOPED_ROLES.includes(String(effectiveRole || "").toUpperCase()) &&
      !user.hospital &&
      !req.headers["x-hospital"]
    ) {
      effectiveRole = actualRole;
    }
    user.actualRole = actualRole;
    user.effectiveRole = effectiveRole;
    user.role = effectiveRole;

    // normalize common field access
    user.hospitalId = user.hospital;

    /* ======================================================
       🔐 FORCE 2FA FOR ADMINS
    ====================================================== */
    const isAdmin =
      user.role === "SUPER_ADMIN" ||
      user.role === "SUPER_ASSISTANT" ||
      user.role === "SYSTEM_ADMIN" ||
      user.role === "HOSPITAL_ADMIN" ||
      user.role === "GOVERNMENT_ADMIN" ||
      user.role === "GOVERNMENT_REGULATOR" ||
      user.role === "GOVERNMENT_AUDITOR" ||
      user.role === "GOVERNMENT_INSPECTOR";

    if (isAdmin && decoded.twoFactorVerified !== true) {
      return res.status(403).json({
        message: "2FA required for admin accounts",
        code: "ADMIN_2FA_REQUIRED",
      });
    }

    const url = req.originalUrl || "";
    const restrictionExempt =
      url.startsWith("/api/auth/session-risk") ||
      url.startsWith("/api/auth/step-up/request") ||
      url.startsWith("/api/auth/step-up/verify") ||
      url.startsWith("/api/auth/logout");
    if (!restrictionExempt) {
      const restricted = await safeRedisGet(`risk:restricted:${String(user._id)}`);
      if (restricted) {
        let payload = null;
        try {
          payload = JSON.parse(restricted);
        } catch {
          payload = { reason: "RISK_RESTRICTION_ACTIVE", until: null };
        }
        return res.status(403).json({
          message: "Session temporarily restricted by risk policy",
          code: "SESSION_RESTRICTED",
          restriction: payload,
        });
      }
    }

    // Attach user and token payload to request
    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    if (!isJwtError(error) && error?.code === "AUTH_BACKEND_TIMEOUT") {
      console.error("Auth backend timeout:", error.message);
      return authBackendUnavailable(res);
    }
    if (!isJwtError(error) && error?.code === "AUTH_BACKEND_UNAVAILABLE") {
      console.error("Auth backend unavailable:", error.message);
      return authBackendUnavailable(res);
    }
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Not authorized" });
  }
};

const authenticateOptional = async (req, _res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = verifyAccessToken(token);

    const user = await withTimeout(
      User.findById(decoded.id).select("-password"),
      AUTH_LOOKUP_TIMEOUT_MS,
      `Optional auth user lookup timed out for ${decoded.id}`
    );
    if (!user) return next();
    if (user.active === false) return next();

    const actualRole = user.role;
    let effectiveRole = resolveEffectiveRole(req, actualRole);
    if (
      effectiveRole !== actualRole &&
      HOSPITAL_SCOPED_ROLES.includes(String(effectiveRole || "").toUpperCase()) &&
      !user.hospital &&
      !req.headers["x-hospital"]
    ) {
      effectiveRole = actualRole;
    }

    user.actualRole = actualRole;
    user.effectiveRole = effectiveRole;
    user.role = effectiveRole;
    user.hospitalId = user.hospital;
    req.user = user;
    req.tokenPayload = decoded;
    return next();
  } catch {
    return next();
  }
};

/* ======================================================
   EXPORTS
====================================================== */
export const protect = authenticate;
export const requireAuth = protect; // ✅ alias for legacy routes
export const protectOptional = authenticateOptional;

/* ======================================================
   ROLE-BASED AUTHORIZATION (WITH HIERARCHY)
====================================================== */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userPriority = ROLE_PRIORITY[req.user.role] ?? 0;

    const allowed = allowedRoles.some(
      (role) => userPriority >= (ROLE_PRIORITY[role] ?? 0)
    );

    if (!allowed) {
      if (isPrivilegedOverrideAllowed(req)) {
        return next();
      }
      if (isReadOnlyOverrideAllowed(req)) {
        return next();
      }
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
