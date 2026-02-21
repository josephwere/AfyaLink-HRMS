import AuditLog from "../models/AuditLog.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

export const getAuditLogs = async (req, res) => {
  const {
    action,
    actorId,
    resource,
    success,
    page = 1,
    limit = 50,
    cursor = null,
  } = req.query;

  const safePage = Math.max(parseInt(page, 10), 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10), 1), 100);

  const query = {};
  const role = normalizeRole(req.user?.role || "");
  if (["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "HR_MANAGER", "PAYROLL_OFFICER"].includes(role)) {
    query.hospital = req.user?.hospital || req.user?.hospitalId;
  }

  if (action) query.action = action;
  if (actorId) query.actorId = actorId;
  if (resource) query.resource = resource;
  if (success === "true") query.success = true;
  if (success === "false") query.success = false;

  if (cursor) {
    const parsed = decodeCursor(cursor);
    if (!parsed?.createdAt || !parsed?._id) {
      return res.status(400).json({ message: "Invalid cursor" });
    }
    query.$and = [
      {
        $or: [
          { createdAt: { $lt: new Date(parsed.createdAt) } },
          { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
        ],
      },
    ];

    const rows = await AuditLog.find(query)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit + 1)
      .lean();
    const hasMore = rows.length > safeLimit;
    const items = hasMore ? rows.slice(0, safeLimit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
      : null;
    return res.json({ items, nextCursor, hasMore, limit: safeLimit });
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  res.json({ items, total, page: safePage, limit: safeLimit });
};
