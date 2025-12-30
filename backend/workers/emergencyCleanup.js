import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   🚨 EMERGENCY AUTO-EXPIRE + AUDIT CLEANUP
   - Runs via cron
   - Idempotent (safe to run multiple times)
====================================================== */
export const cleanupExpiredEmergencyAccess = async () => {
  const now = new Date();

  try {
    /* ======================================================
       FIND USERS WITH EXPIRED EMERGENCY ACCESS
    ====================================================== */
    const expiredUsers = await User.find({
      "emergencyAccess.active": true,
      "emergencyAccess.expiresAt": { $lte: now },
    }).lean();

    if (expiredUsers.length === 0) {
      return;
    }

    for (const user of expiredUsers) {
      /* ======================================================
         DISABLE EMERGENCY ACCESS
      ====================================================== */
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "emergencyAccess.active": false,
            "emergencyAccess.revokedAt": now,
          },
        }
      );

      /* ======================================================
         AUDIT LOG — AUTO EXPIRE
      ====================================================== */
      await AuditLog.create({
        actorId: user.emergencyAccess.triggeredBy,
        actorRole: "SYSTEM",
        action: "BREAK_GLASS_AUTO_EXPIRED",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital,
        success: true,
        metadata: {
          triggeredAt: user.emergencyAccess.triggeredAt,
          expiredAt: user.emergencyAccess.expiresAt,
          autoExpiredAt: now,
          reason: user.emergencyAccess.reason,
        },
      });
    }

    console.log(
      `🚨 Emergency cleanup: ${expiredUsers.length} access sessions auto-expired`
    );
  } catch (err) {
    console.error("❌ Emergency cleanup failed:", err);

    await AuditLog.create({
      actorRole: "SYSTEM",
      action: "BREAK_GLASS_CLEANUP_FAILED",
      resource: "System",
      success: false,
      error: err.message,
    });
  }
};
