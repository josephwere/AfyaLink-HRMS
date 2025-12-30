import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/* ======================================================
   ROLE HIERARCHY (HIGH → LOW)
====================================================== */
const ROLE_PRIORITY = {
  SUPER_ADMIN: 100,
  HOSPITAL_ADMIN: 80,
  DOCTOR: 60,
  NURSE: 60,
  LAB_TECH: 60,
  PHARMACIST: 60,
  PATIENT: 10,
  GUEST: 0,
};

/* ======================================================
   AUTHENTICATION
====================================================== */
const authenticate = async (req, res, next) => {
  try {
    let token;

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
      process.env.JWT_SECRET || "change_this_secret"
    );

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    /* ======================================================
       🔐 FORCE 2FA FOR ADMINS
    ====================================================== */
    const isAdmin =
      user.role === "SUPER_ADMIN" || user.role === "HOSPITAL_ADMIN";

    if (isAdmin && decoded.twoFactorVerified !== true) {
      return res.status(403).json({
        message: "2FA required for admin accounts",
        code: "ADMIN_2FA_REQUIRED",
      });
    }

    req.user = user;
    req.tokenPayload = decoded; // useful later
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized" });
  }
};

/* ======================================================
   EXPORTS
====================================================== */
export const protect = authenticate;
export const requireAuth = authenticate;

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
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
