import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/* ======================================================
   🚨 REVOKE EMERGENCY ACCESS — SUPER_ADMIN ONLY
====================================================== */
router.post(
  "/revoke/:userId",
  auth,
  authorize("emergency", "revoke"), // SUPER_ADMIN policy
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.emergencyAccess?.active) {
        return res.status(400).json({
          message: "User does not have active emergency access",
        });
      }

      const beforeState = user.emergencyAccess;

      // 🔥 REVOKE
      user.emergencyAccess = {
        active: false,
        revokedAt: new Date(),
        revokedBy: req.user._id,
      };

      await user.save();

      /* ================= AUDIT LOG ================= */
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "REVOKE_EMERGENCY_ACCESS",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital,
        before: beforeState,
        after: user.emergencyAccess,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: true,
      });

      res.json({
        message: "Emergency access revoked successfully",
      });
    } catch (err) {
      console.error(err);

      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "REVOKE_EMERGENCY_ACCESS_FAILED",
        resource: "User",
        resourceId: req.params.userId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        error: err.message,
      });

      res.status(500).json({
        message: "Failed to revoke emergency access",
      });
    }
  }
);

export default router;
