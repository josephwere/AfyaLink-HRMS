import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import AuditLog from "../models/AuditLog.js";

const router = express.Router();

/**
 * GET /api/audit
 * Filters: actorId, action, resource, from, to
 * RBAC: SuperAdmin / HospitalAdmin
 */
router.get(
  "/",
  auth,
  authorize("audit", "read"),
  async (req, res) => {
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
    if (req.user.role !== "SuperAdmin") {
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
  }
);

export default router;
