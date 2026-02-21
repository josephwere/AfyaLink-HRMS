// backend/routes/auditRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { featureGuard } from "../middleware/featureGuard.js";
import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";
import ComplianceLedger from "../models/ComplianceLedger.js";

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

/**
 * GET /api/audit/evidence-bundle
 * For legal/regulatory investigations:
 * returns time-bounded action logs + immutable ledger records.
 */
router.get(
  "/evidence-bundle",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "SECURITY_ADMIN", "DEVELOPER"),
  async (req, res) => {
    try {
      const {
        from,
        to,
        actorId,
        resource,
        action,
        hospitalId,
        page = 1,
        limit = 100,
      } = req.query;

      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
      const actorRole = req.user.actualRole || req.user.role;
      const isPrivileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);

      const filter = {};
      if (actorId) filter.actorId = actorId;
      if (resource) filter.resource = resource;
      if (action) filter.action = action;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      if (!isPrivileged) {
        filter.hospital = req.user.hospital;
      } else if (hospitalId) {
        filter.hospital = hospitalId;
      }

      const ledgerFilter = {};
      if (filter.hospital) ledgerFilter.hospital = filter.hospital;
      if (action) ledgerFilter.action = action;
      if (resource) ledgerFilter.resource = resource;
      if (from || to) {
        ledgerFilter.createdAt = {};
        if (from) ledgerFilter.createdAt.$gte = new Date(from);
        if (to) ledgerFilter.createdAt.$lte = new Date(to);
      }

      const [logs, logTotal, ledgerEntries] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .populate("actorId", "name email role")
          .lean(),
        AuditLog.countDocuments(filter),
        ComplianceLedger.find(ledgerFilter)
          .sort({ createdAt: -1 })
          .limit(safeLimit)
          .lean(),
      ]);

      return res.json({
        success: true,
        meta: {
          generatedAt: new Date().toISOString(),
          page: Math.max(Number(page) || 1, 1),
          limit: safeLimit,
          totalLogs: logTotal,
          immutableLedgerIncluded: true,
        },
        logs,
        ledgerEntries,
      });
    } catch (err) {
      console.error("Evidence bundle generation failed:", err);
      res.status(500).json({ msg: "Failed to generate evidence bundle" });
    }
  }
);

export default router;
