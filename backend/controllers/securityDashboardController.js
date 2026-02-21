import AccessEntry from "../models/AccessEntry.js";
import AuditLog from "../models/AuditLog.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

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
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 100);
    const cursor = req.query.cursor || null;

    const filter = {
      hospital: req.user.hospital,
    };

    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      filter.$or = [
        { createdAt: { $lt: new Date(parsed.createdAt) } },
        { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
      ];
      const rows = await AccessEntry.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate("personRef", "name fullName phone")
        .lean();
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      AccessEntry.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("personRef", "name fullName phone")
        .lean(),
      AccessEntry.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: "Failed to load logs" });
  }
};
