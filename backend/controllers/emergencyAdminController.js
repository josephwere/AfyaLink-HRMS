import BreakGlass from "../models/BreakGlass.js";
import Hospital from "../models/Hospital.js";

/**
 * SUPER ADMIN — LIVE EMERGENCY DASHBOARD
 * Shows all ACTIVE break-glass sessions system-wide
 */
export const getActiveEmergencies = async (req, res) => {
  try {
    /* ================= ROLE GUARD ================= */
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "SuperAdmin access only",
      });
    }

    const now = new Date();

    /* ================= LOAD ACTIVE EMERGENCIES ================= */
    const emergencies = await BreakGlass.find({
      active: true,
      expiresAt: { $gt: now }, // still valid
    })
      .populate({
        path: "hospital",
        select: "name code plan active",
      })
      .populate({
        path: "activatedBy",
        select: "name email role",
      })
      .sort({ createdAt: -1 })
      .lean();

    /* ================= SHAPE RESPONSE ================= */
    const data = emergencies.map((e) => ({
      id: e._id,
      hospital: {
        id: e.hospital?._id,
        name: e.hospital?.name,
        code: e.hospital?.code,
        plan: e.hospital?.plan,
        active: e.hospital?.active,
      },
      activatedBy: {
        id: e.activatedBy?._id,
        name: e.activatedBy?.name,
        email: e.activatedBy?.email,
        role: e.activatedBy?.role,
      },
      reason: e.reason,
      startedAt: e.createdAt,
      expiresAt: e.expiresAt,
      remainingMinutes: Math.max(
        0,
        Math.floor((new Date(e.expiresAt) - now) / 60000)
      ),
    }));

    res.json({
      count: data.length,
      emergencies: data,
    });
  } catch (err) {
    console.error("Emergency dashboard error:", err);
    res.status(500).json({
      message: "Failed to load emergency dashboard",
    });
  }
};
