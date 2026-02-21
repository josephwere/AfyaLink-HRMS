import AuditLog from "../models/AuditLog.js";

export const denyAudit = async (req, res, message) => {
  if (!req.user) return;

  await AuditLog.create({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "ACCESS_DENIED",
    resource: req.originalUrl,
    hospital: req.user.hospitalId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    success: false,
    error: message,
  });
};
