import AuditLog from "../models/AuditLog.js";
import { detectAnomaly } from "./anomaly.js";

export const audit = async ({
  req,
  action,
  resource,
  resourceId,
  metadata = {},
  before,
  after,
  success = true,
  error,
}) => {
  try {
    if (!req?.user) return;

    const anomaly = detectAnomaly({
      action,
      role: req.user.role,
    });

    await AuditLog.create({
      /* ================= WHO ================= */
      actorId: req.user._id,
      actorRole: req.user.role,

      /* ================= WHAT ================= */
      action,
      resource,
      resourceId,

      /* ================= STATE ================= */
      before,
      after,

      /* ================= TENANCY ================= */
      hospital: req.user.hospital,

      /* ================= CONTEXT ================= */
      ip: req.ip,
      userAgent: req.headers["user-agent"],

      /* ================= RESULT ================= */
      success,
      error,

      /* ================= METADATA ================= */
      metadata: {
        ...metadata,
        anomaly, // 👈 non-blocking security signal
      },
    });
  } catch (err) {
    // Audit must NEVER break the app
    console.error("AUDIT FAILED:", err.message);
  }
};
