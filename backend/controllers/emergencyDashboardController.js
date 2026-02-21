import BreakGlass from "../models/BreakGlass.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   🚨 SUPER ADMIN — EMERGENCY DASHBOARD
====================================================== */
export const emergencyDashboard = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const now = new Date();

    /* ================= LIVE EMERGENCIES ================= */
    const live = await BreakGlass.find({ active: true })
      .populate("hospital", "name plan")
      .populate("activatedBy", "name email role")
      .lean();

    const liveFormatted = live.map((e) => ({
      hospital: {
        id: e.hospital._id,
        name: e.hospital.name,
        plan: e.hospital.plan,
      },
      activatedBy: {
        id: e.activatedBy._id,
        name: e.activatedBy.name,
        email: e.activatedBy.email,
        role: e.activatedBy.role,
      },
      reason: e.reason,
      startedAt: e.createdAt,
      expiresAt: e.expiresAt,
      active: e.expiresAt > now,
    }));

    /* ================= SUMMARY ================= */
    const total = await BreakGlass.countDocuments();
    const active = await BreakGlass.countDocuments({
      active: true,
      expiresAt: { $gt: now },
    });
    const expired = total - active;

    /* ================= ANALYTICS ================= */

    const topUsers = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $group: {
          _id: "$actorId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const topHospitals = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $group: {
          _id: "$hospital",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const reasons = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED" } },
      {
        $group: {
          _id: "$metadata.reason",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const durations = await BreakGlass.aggregate([
      {
        $project: {
          duration: {
            $divide: [
              { $subtract: ["$expiresAt", "$createdAt"] },
              60000,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgMinutes: { $avg: "$duration" },
          maxMinutes: { $max: "$duration" },
        },
      },
    ]);

    res.json({
      summary: {
        active,
        expired,
        total,
      },
      live: liveFormatted,
      analytics: {
        topUsers,
        topHospitals,
        reasons: reasons.map((r) => ({
          reason: r._id,
          count: r.count,
        })),
        durations: durations[0] || { avgMinutes: 0, maxMinutes: 0 },
      },
    });
  } catch (err) {
    console.error("Emergency dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};
