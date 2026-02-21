import Notification from "../models/Notification.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

export const index = async (req, res) => {
  return list(req, res);
};

export const list = async (req, res) => {
  const userId = req.user?._id;
  const hospitalId = req.user?.hospital || req.user?.hospitalId;

  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);
  const cursor = req.query.cursor || null;

  const filters = [{ user: userId }];
  if (req.user?.role === "HOSPITAL_ADMIN" && hospitalId) {
    filters.push({ hospital: hospitalId });
  }

  const query = { $or: filters };
  if (req.query.category) {
    query.category = req.query.category;
  }
  if (req.query.read === "true") {
    query.read = true;
  }
  if (req.query.read === "false") {
    query.read = false;
  }

  // Cursor mode: stable pagination by createdAt + _id
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

    const rows = await Notification.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({
          createdAt: last.createdAt,
          _id: last._id,
        })
      : null;
    return res.json({ items, nextCursor, hasMore, limit });
  }

  const [items, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(query),
  ]);

  return res.json({ items, total, page, limit });
};

export const markRead = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const { id } = req.params;
  const item = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: true },
    { new: true }
  );

  if (!item) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.json({ item });
};

export const markAllRead = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  await Notification.updateMany({ user: userId, read: false }, { read: true });
  res.json({ ok: true });
};

export const markUnread = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const { id } = req.params;
  const item = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: false },
    { new: true }
  );

  if (!item) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.json({ item });
};
