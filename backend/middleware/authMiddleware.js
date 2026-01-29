import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* ======================================================
   AUTHENTICATION (JWT + 2FA ENFORCEMENT)
====================================================== */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    // Force 2FA for admins
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "HOSPITAL_ADMIN";
    if (isAdmin && decoded.twoFactorVerified !== true) {
      return res.status(403).json({
        message: "2FA verification required",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* ======================================================
   ROLE-BASED AUTHORIZATION
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

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const userPriority = ROLE_PRIORITY[req.user.role] || 0;
    const allowed = allowedRoles.some((role) => userPriority >= (ROLE_PRIORITY[role] || 0));

    if (!allowed) return res.status(403).json({ message: "Access denied" });

    next();
  };
};
