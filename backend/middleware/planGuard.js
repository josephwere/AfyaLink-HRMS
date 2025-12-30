// backend/middleware/planGuard.js

import Hospital from "../models/Hospital.js";
import { denyAudit } from "./denyAudit.js";
import { isBreakGlassActive } from "./breakGlassGuard.js";
/* ================= BREAK-GLASS OVERRIDE ================= */
const breakGlass = await isBreakGlassActive(hospitalId);
if (breakGlass) {
  req.breakGlass = true; // expose to controllers
  return next();
}

/**
 * PLAN + LIMIT + FEATURE ENFORCEMENT
 * Source of truth: Hospital
 */
export const planGuard =
  ({ feature, limitKey }) =>
  async (req, res, next) => {
    try {
      const hospitalId = req.user.hospitalId;
      if (!hospitalId) return next();

      const hospital = await Hospital.findOne({
        _id: hospitalId,
        active: true,
      }).lean();

      if (!hospital) {
        return res.status(403).json({
          message: "Hospital inactive",
        });
      }

      /* ================= FEATURE CHECK ================= */
      if (feature && !hospital.features?.[feature]) {
        await denyAudit(
          req,
          res,
          `Feature '${feature}' blocked by plan`
        );

        return res.status(403).json({
          message: "Upgrade plan to access this feature",
        });
      }

      /* ================= LIMIT CHECK ================= */
      if (limitKey) {
        const current = await getUsageCount(limitKey, hospitalId);
        const allowed = hospital.limits?.[limitKey];

        if (
          typeof allowed === "number" &&
          current >= allowed
        ) {
          await denyAudit(
            req,
            res,
            `Plan limit exceeded (${limitKey})`
          );

          return res.status(429).json({
            message: `Plan limit reached (${limitKey})`,
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };

/* ================= USAGE COUNTS ================= */
async function getUsageCount(key, hospitalId) {
  switch (key) {
    case "users": {
      const { default: User } = await import(
        "../models/User.js"
      );
      return User.countDocuments({
        hospital: hospitalId,
        active: true,
      });
    }

    case "patients": {
      const { default: Patient } = await import(
        "../models/Patient.js"
      );
      return Patient.countDocuments({
        hospital: hospitalId,
        active: true,
      });
    }

    default:
      return 0;
  }
}
