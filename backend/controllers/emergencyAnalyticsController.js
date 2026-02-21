import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   🚨 SUPERADMIN — EMERGENCY ANALYTICS
====================================================== */
export const emergencyAnalytics = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    /* ======================================================
       1️⃣ WHO TRIGGERS MOST
    ====================================================== */
    const topUsers = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $group: {
          _id: "$actorId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          role: "$user.role",
          count: 1,
        },
      },
    ]);

    /* ======================================================
       2️⃣ HOSPITALS WITH MOST EMERGENCIES
    ====================================================== */
    const topHospitals = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $group: {
          _id: "$hospital",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "hospitals",
          localField: "_id",
          foreignField: "_id",
          as: "hospital",
        },
      },
      { $unwind: "$hospital" },
      {
        $project: {
          _id: 0,
          hospitalId: "$hospital._id",
          name: "$hospital.name",
          plan: "$hospital.plan",
          count: 1,
        },
      },
    ]);

    /* ======================================================
       3️⃣ TOP REASONS
    ====================================================== */
    const reasons = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $group: {
          _id: "$metadata.reason",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          reason: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    /* ======================================================
       4️⃣ DURATION STATS
    ====================================================== */
    const durations = await AuditLog.aggregate([
      { $match: { action: "BREAK_GLASS_ACTIVATED", success: true } },
      {
        $project: {
          durationMs: {
            $subtract: [
              { $toDate: "$metadata.expiresAt" },
              "$createdAt",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: "$durationMs" },
          maxMs: { $max: "$durationMs" },
        },
      },
      {
        $project: {
          _id: 0,
          avgMinutes: { $divide: ["$avgMs", 60000] },
          maxMinutes: { $divide: ["$maxMs", 60000] },
        },
      },
    ]);

    /* ======================================================
       RESPONSE
    ====================================================== */
    res.json({
      topUsers,
      topHospitals,
      reasons,
      durations: durations[0] || { avgMinutes: 0, maxMinutes: 0 },
    });
  } catch (err) {
    console.error("Emergency analytics error:", err);
    res.status(500).json({
      message: "Failed to load emergency analytics",
    });
  }
};
