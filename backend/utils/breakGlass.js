import BreakGlass from "../models/BreakGlass.js";
import { audit } from "./audit.js";

/* ======================================================
   🔎 CHECK IF EMERGENCY MODE IS ACTIVE
   - Used by menu, guards, permissions
   - Auto-expires silently if time passed
====================================================== */
export const isBreakGlassActive = async (hospitalId) => {
  if (!hospitalId) return false;

  const now = new Date();

  const emergency = await BreakGlass.findOne({
    hospital: hospitalId,
    active: true,
    expiresAt: { $gt: now },
  }).select("_id");

  return !!emergency;
};

/* ======================================================
   ⏱ AUTO-EXPIRE EMERGENCIES (CRON SAFE)
   - Can run every minute
   - Idempotent
   - Fully audited
====================================================== */
export const expireEmergencies = async () => {
  const now = new Date();

  const expired = await BreakGlass.find({
    active: true,
    expiresAt: { $lte: now },
  });

  for (const emergency of expired) {
    emergency.active = false;
    emergency.metadata = {
      ...emergency.metadata,
      autoExpiredAt: now,
    };

    await emergency.save();

    // 🔒 System audit (no req)
    await audit({
      req: {
        user: {
          _id: null,
          role: "SYSTEM",
          hospital: emergency.hospital,
        },
        ip: "127.0.0.1",
        headers: {},
      },
      action: "AUTO_EXPIRE_EMERGENCY",
      resource: "BreakGlass",
      resourceId: emergency._id,
      metadata: {
        expiresAt: emergency.expiresAt,
      },
    });
  }

  return expired.length;
};

/* ======================================================
   📊 SUPER ADMIN — ACTIVE EMERGENCY DASHBOARD
====================================================== */
export const listActiveEmergencies = async () => {
  return BreakGlass.find({
    active: true,
    expiresAt: { $gt: new Date() },
  })
    .populate("hospital", "name code plan")
    .populate("activatedBy", "name email role")
    .sort({ createdAt: -1 })
    .lean();
};
