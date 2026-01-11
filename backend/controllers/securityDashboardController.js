import AccessEntry from "../models/AccessEntry.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   👥 WHO IS INSIDE RIGHT NOW
====================================================== */
export const liveOccupancy = async (req, res) => {
  try {
    const now = new Date();

    const active = await AccessEntry.find({
      hospital: req.user.hospital,
      checkedInAt: { $ne: null },
      checkedOutAt: null,
      expiresAt: { $gt: now },
      status: "ACTIVE",
    })
      .populate("personRef", "name fullName phone")
      .lean();

    res.json({
      count: active.length,
      peopleInside: active,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load occupancy" });
  }
};

/* ======================================================
   ⏱ OVERSTAYS & EXPIRED BUT STILL INSIDE
====================================================== */
export const overstays = async (req, res) => {
  try {
    const now = new Date();

    const overstayed = await AccessEntry.find({
      hospital: req.user.hospital,
      checkedInAt: { $ne: null },
      checkedOutAt: null,
      expiresAt: { $lt: now },
    })
      .populate("personRef", "name fullName phone")
      .lean();

    res.json({
      count: overstayed.length,
      overstayed,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load overstays" });
  }
};

/* ======================================================
   🚨 SECURITY ALERTS
====================================================== */
export const securityAlerts = async (req, res) => {
  try {
    const alerts = await AuditLog.find({
      hospital: req.user.hospital,
      action: {
        $in: [
          "ACCESS_AREA_VIOLATION",
          "INVALID_ACCESS_ATTEMPT",
          "ACCESS_EXPIRED_ATTEMPT",
        ],
      },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      alerts,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load alerts" });
  }
};

/* ======================================================
   📍 AREA OCCUPANCY
====================================================== */
export const areaOccupancy = async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          hospital: req.user.hospital,
          checkedInAt: { $ne: null },
          checkedOutAt: null,
        },
      },
      { $unwind: "$areasAllowed" },
      {
        $group: {
          _id: "$areasAllowed",
          count: { $sum: 1 },
        },
      },
    ];

    const areas = await AccessEntry.aggregate(pipeline);

    res.json({ areas });
  } catch (err) {
    res.status(500).json({ message: "Failed to load area data" });
  }
};

/* ======================================================
   📜 FULL ACCESS LOGS (PAGINATED)
====================================================== */
export const accessLogs = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = 50;
    const skip = (page - 1) * limit;

    const logs = await AccessEntry.find({
      hospital: req.user.hospital,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("personRef", "name fullName phone")
      .lean();

    res.json({
      page,
      logs,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load logs" });
  }
};
