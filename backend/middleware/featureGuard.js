import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";

/**
 * Feature Guard
 * Blocks access if hospital feature is disabled
 *
 * @param {string} featureKey - e.g. "auditLogs", "adminCreation"
 */
export const featureGuard = (featureKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      // Super Admin bypass (platform owner)
      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      if (!user.hospitalId) {
        return res.status(403).json({ message: "No hospital context" });
      }

      const hospital = await Hospital.findById(user.hospitalId);

      const enabled = hospital?.features?.[featureKey];

      if (!enabled) {
        /* ================= AUDIT DENIAL ================= */
        await AuditLog.create({
          actorId: user._id,
          actorRole: user.role,
          action: "ACCESS_DENIED",
          resource: featureKey,
          hospital: user.hospitalId,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          success: false,
          error: `Feature '${featureKey}' disabled for hospital`,
        });

        return res.status(403).json({
          message: "Feature not enabled for your hospital",
        });
      }

      next();
    } catch (err) {
      console.error("FeatureGuard error:", err);
      res.status(500).json({ message: "Feature validation failed" });
    }
  };
};
