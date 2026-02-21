import AuditLog from "../models/AuditLog.js";
import { appendComplianceLedger } from "./complianceLedger.js";

export async function recordExportEvent({
  req,
  action,
  resource,
  resourceId = null,
  format,
  rowCount = null,
  metadata = {},
}) {
  try {
    const actorId = req.user?._id || null;
    const actorRole = req.user?.role || null;
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const baseMeta = {
      format,
      rowCount,
      ...metadata,
    };

    await AuditLog.create({
      actorId,
      actorRole,
      action,
      resource,
      resourceId: resourceId || undefined,
      hospital,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
      metadata: baseMeta,
    });

    await appendComplianceLedger({
      actorId,
      actorRole,
      action,
      resource,
      resourceId,
      hospital,
      metadata: baseMeta,
    });
  } catch (err) {
    console.error("EXPORT_AUDIT_FAILED:", err.message);
  }
}

