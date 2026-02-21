import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { featureGuard } from "../middleware/featureGuard.js";

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

import { revokeEmergencyAccess } from "../controllers/adminController.js";
import { emergencyAnalytics } from "../controllers/emergencyAnalyticsController.js";

const router = express.Router();

/* ======================================================
   🚨 SUPER_ADMIN — REVOKE EMERGENCY ACCESS
====================================================== */
router.post(
  "/emergency/:hospitalId/revoke",
  protect,
  requireRole("SUPER_ADMIN"),
  revokeEmergencyAccess
);

/* ======================================================
   📊 EMERGENCY ANALYTICS — SUPER_ADMIN ONLY
====================================================== */
router.get(
  "/emergency-analytics",
  protect,
  requireRole("SUPER_ADMIN"),
  emergencyAnalytics
);

/* ======================================================
   👤 CREATE STAFF — SUPER_ADMIN & HOSPITAL_ADMIN
====================================================== */
router.post(
  "/create-admin",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  featureGuard("adminCreation"),
  async (req, res) => {
    try {
      const { name, email, password, role, hospitalId } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({ msg: "Missing required fields" });
      }

      const allowedRoles = [
        "HOSPITAL_ADMIN",
        "DOCTOR",
        "NURSE",
        "LAB_TECH",
        "PHARMACIST",
      ];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ msg: "Invalid staff role" });
      }

      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(409).json({ msg: "User already exists" });
      }

      const user = await User.create({
        name,
        email,
        password,
        role,
        hospitalId,
        emailVerified: true,
      });

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "CREATE_STAFF",
        resource: "User",
        resourceId: user._id,
        hospital: hospitalId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: true,
      });

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        msg: "Failed to create staff",
      });
    }
  }
);

export default router;
