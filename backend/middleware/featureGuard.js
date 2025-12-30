// backend/middleware/featureGuard.js
import Hospital from "../models/Hospital.js";
import { denyAudit } from "./denyAudit.js";

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

      // 🔓 SUPER_ADMIN bypass (platform owner)
      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      if (!user.hospitalId) {
        await denyAudit(req, res, "No hospital context");
        return res.status(403).json({ message: "No hospital context" });
      }

      const hospital = await Hospital.findById(user.hospitalId).lean();

      const enabled = hospital?.features?.[featureKey];

      if (!enabled) {
        await denyAudit(
          req,
          res,
          `Feature '${featureKey}' disabled for hospital`
        );

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
