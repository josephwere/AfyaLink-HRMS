import express from "express";
import { protect, requireRole } from "../middleware/auth.js";
import { featureGuard } from "../middleware/featureGuard.js"; // ✅ NEW
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/**
 * GET /api/audit
 * Filters: actorId, action, resource, from, to
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
  featureGuard("auditLogs"), // 🔐 ENTERPRISE GUARD
  async (req, res) => {
    try {
      const {
        actorId,
        action,
        resource,
        from,
        to,
        page = 1,
        limit = 50,
      } = req.query;

      const filter = {};

      /* ================= FILTERS ================= */
      if (actorId) filter.actorId = actorId;
      if (action) filter.action = action;
      if (resource) filter.resource = resource;

      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      /* ================= TENANCY ISOLATION ================= */
      // SUPER_ADMIN → full visibility
      // HOSPITAL_ADMIN → scoped
      if (req.user.role === "HOSPITAL_ADMIN") {
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
