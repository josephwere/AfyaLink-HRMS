import AuditLog from "../models/AuditLog.js";

/* ======================================================
   CENTRAL AUDIT SERVICE (AUTHORITATIVE)
   🔒 Single write path for audit logs
====================================================== */

/**
 * logAudit
 * ----------------------------------
 * The ONLY supported way to write audit logs.
 * Safe to call from:
 * - workflow engine
 * - workflow effects
 * - payment finalization
 * - security middleware
 */
export async function logAudit({
  actorId,
  actorRole,
  action,
  resource,
  resourceId,
  before = null,
  after = null,
  hospital,
  ip,
  userAgent,
  success = true,
  error = null,
}) {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      resource,
      resourceId,
      before,
      after,
      hospital,
      ip,
      userAgent,
      success,
      error,
      $locals: { viaWorkflow: true },
    });
  } catch (err) {
    /**
     * ⚠️ IMPORTANT
     * Audit failure must NEVER break production flows.
     * We log loudly, but we do NOT throw.
     */
    console.error("🚨 AUDIT WRITE FAILED:", {
      action,
      resource,
      resourceId,
      error: err.message,
    });
  }
}
