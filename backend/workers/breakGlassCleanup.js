import BreakGlass from "../models/BreakGlass.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   🚨 AUTO-EXPIRE BREAK-GLASS ACCESS
====================================================== */
export const cleanupExpiredBreakGlass = async () => {
  try {
    const now = new Date();

    const expired = await BreakGlass.find({
      active: true,
      expiresAt: { $lte: now },
    });

    if (expired.length === 0) return;

    for (const record of expired) {
      record.active = false;
      record.metadata = {
        ...record.metadata,
        expiredAutomatically: true,
        expiredAt: now,
      };

      await record.save();

      await AuditLog.create({
        actorId: record.activatedBy,
        actorRole: "SYSTEM",
        action: "BREAK_GLASS_EXPIRED",
        resource: "Hospital",
        resourceId: record.hospital,
        hospital: record.hospital,
        success: true,
        metadata: {
          breakGlassId: record._id,
          expiresAt: record.expiresAt,
        },
      });
    }

    console.log(
      `🚨 Break-glass auto-expired: ${expired.length} record(s)`
    );
  } catch (err) {
    console.error("❌ Break-glass cleanup failed:", err.message);
  }
};
