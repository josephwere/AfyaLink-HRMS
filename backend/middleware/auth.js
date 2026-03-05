import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { resolveEffectiveRole } from "./effectiveRole.js";
import { HOSPITAL_SCOPED_ROLES } from "../utils/roleSets.js";

/* ======================================================
   AUTHENTICATION (JWT + 2FA ENFORCEMENT)
====================================================== */
export default async function auth(req, res, next) {
  try {
    // Allow refresh endpoint to bypass access-token auth
    if (req.originalUrl === "/api/auth/refresh") {
      return next();
    }

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Missing authorization token",
      });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

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

    if (decoded.twoFactorVerified === false) {
      return res.status(403).json({
        message: "2FA verification required",
      });
    }

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
