// backend/middleware/authMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";
import { isPrivilegedOverrideAllowed, isReadOnlyOverrideAllowed } from "./readOnlyOverride.js";
import { resolveEffectiveRole } from "./effectiveRole.js";
import { redis } from "../utils/redis.js";

dotenv.config();

/* ======================================================
   ROLE HIERARCHY (HIGH → LOW)
====================================================== */
const ROLE_PRIORITY = {
  SUPER_ADMIN: 100,
  SYSTEM_ADMIN: 90,
  HOSPITAL_ADMIN: 80,
  DOCTOR: 60,
  NURSE: 60,
  LAB_TECH: 60,
  PHARMACIST: 60,
  HR_MANAGER: 60,
  PAYROLL_OFFICER: 60,
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const actualRole = user.role;
    const effectiveRole = resolveEffectiveRole(req, actualRole);
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
      user.role === "SYSTEM_ADMIN" ||
      user.role === "HOSPITAL_ADMIN";

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
      const restricted = await redis.get(`risk:restricted:${String(user._id)}`);
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
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Not authorized" });
  }
};

/* ======================================================
   EXPORTS
====================================================== */
export const protect = authenticate;
export const requireAuth = protect; // ✅ alias for legacy routes

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
