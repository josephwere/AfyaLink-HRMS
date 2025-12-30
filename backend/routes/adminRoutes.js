import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { featureGuard } from "../middleware/featureGuard.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/* ======================================================
   CREATE ADMIN — SUPER_ADMIN ONLY
====================================================== */
router.post(
  "/create-admin",
  auth,
  authorize("admin", "create"),     // RBAC
  featureGuard("adminCreation"),    // 🏥 Hospital feature toggle
  async (req, res) => {
    try {
      const { name, email, password, role, hospitalId } = req.body;

      if (!email || !password || !role) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "LAB_TECH"].includes(role)) {
        return res.status(400).json({ message: "Invalid admin role" });
      }

      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(409).json({ message: "User already exists" });
      }

      const user = await User.create({
        name,
        email,
        password,
        role,
        hospitalId,
        emailVerified: true,
      });

      /* ================= AUDIT LOG ================= */
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "CREATE_ADMIN",
        resource: "User",
        resourceId: user._id,
        hospital: hospitalId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: true,
      });

      res.status(201).json({
        message: "Admin created successfully",
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      console.error(err);

      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "CREATE_ADMIN_FAILED",
        resource: "User",
        hospital: req.user?.hospitalId,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        success: false,
        error: err.message,
      });

      res.status(500).json({ message: "Failed to create admin" });
    }
  }
);

export default router;
