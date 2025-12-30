import AuditLog from "../models/AuditLog.js";

export const audit = async ({
  req,
  action,
  resource,
  resourceId,
  metadata = {},
}) => {
  try {
    if (!req.user) return;

    await AuditLog.create({
      actor: req.user._id,
      role: req.user.role,
      action,
      resource,
      resourceId,
      hospital: req.user.hospital,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadata,
    });
  } catch (err) {
    console.error("AUDIT FAILED:", err.message);
  }
};
