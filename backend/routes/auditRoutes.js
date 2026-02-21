// backend/routes/auditRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { featureGuard } from "../middleware/featureGuard.js";
import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";

const router = express.Router();

/**
 * GET /api/audit
 * Filters: actor, action, resource, from, to
 *
 * RBAC:
 *  - SUPER_ADMIN → full access
 *  - HOSPITAL_ADMIN → hospital-scoped
 *
 * FEATURE FLAG:
 *  - auditLogs (per-hospital)
 */
router.get(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  featureGuard("auditLogs"),
  async (req, res) => {
    try {
      const {
        actor,
        action,
        resource,
        from,
        to,
        page = 1,
        limit = 50,
      } = req.query;

      const filter = {};

      /* ================= FILTERS ================= */
      if (actor) filter.actorId = actor;
      if (action) filter.action = action;
      if (resource) filter.resource = resource;

      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      /* ================= TENANCY ISOLATION ================= */
      if (req.user.role === "HOSPITAL_ADMIN") {
        // 🔒 Ensure hospital still active
        const hospital = await Hospital.findOne({
          _id: req.user.hospital,
          active: true,
        }).select("_id");

        if (!hospital) {
          return res.json({
            data: [],
            total: 0,
            page: Number(page),
            pageSize: Number(limit),
          });
        }

        filter.hospital = req.user.hospital;
      }

      /* ================= PAGINATION SAFETY ================= */
      const safeLimit = Math.min(Number(limit) || 50, 100);
      const skip = (Number(page) - 1) * safeLimit;

      /* ================= QUERY ================= */
      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .populate("actorId", "name email role")
          .lean(),

        AuditLog.countDocuments(filter),
      ]);

      res.json({
        data: logs,
        total,
        page: Number(page),
        pageSize: safeLimit,
      });
    } catch (err) {
      console.error("Audit log fetch failed:", err);
      res.status(500).json({ msg: "Failed to fetch audit logs" });
    }
  }
);

export default router;
