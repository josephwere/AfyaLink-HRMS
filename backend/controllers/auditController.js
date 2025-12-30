import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  const { action, actor, limit = 50 } = req.query;

  const query = {};
  if (action) query.action = action;
  if (actor) query.actor = actor;

  const logs = await AuditLog.find(query)
    .populate("actor", "name email role")
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(logs);
};
