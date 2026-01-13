import Hospital from "../models/Hospital.js";
import { denyAudit } from "./denyAudit.js";
import { isBreakGlassActive } from "./breakGlassGuard.js";

/**
 * PLAN + LIMIT + FEATURE ENFORCEMENT
 * Source of truth: Hospital
 *
 * Usage:
 * planGuard({ feature: "qrAccess", limitKey: "users" })
 * planGuard({ feature: "emergencyMode" })
 * planGuard({ limitKey: "patients" })
 */
export const planGuard =
  ({ feature = null, limitKey = null } = {}) =>
  async (req, res, next) => {
    try {
      const hospitalId = req.user?.hospitalId || req.user?.hospital;

      /* ================= NO HOSPITAL CONTEXT ================= */
      if (!hospitalId) {
        return next(); // do NOT crash or block
      }

      /* ================= BREAK-GLASS OVERRIDE ================= */
      const breakGlass = await isBreakGlassActive(hospitalId);
      if (breakGlass) {
        req.breakGlass = true; // expose to controllers
        return next();
      }

      const hospital = await Hospital.findOne({
        _id: hospitalId,
        active: true,
      }).lean();

      if (!hospital) {
        return res.status(403).json({
          message: "Hospital inactive or not found",
        });
      }

      /* ================= FEATURE CHECK ================= */
      if (feature) {
        const enabled = hospital.features?.[feature];

        if (!enabled) {
          await denyAudit(
            req,
            res,
            `Feature '${feature}' blocked by plan`
          );

          return res.status(403).json({
            message: "Feature not available in your plan",
          });
        }
      }

      /* ================= LIMIT CHECK ================= */
      if (limitKey) {
        const allowed = hospital.limits?.[limitKey];

        // If limit is undefined/null → unlimited (safe default)
        if (typeof allowed === "number") {
          const current = await getUsageCount(limitKey, hospitalId);

          if (current >= allowed) {
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
      }

      next();
    } catch (err) {
      console.error("planGuard error:", err);
      next(err);
    }
  };

/* ======================================================
   📊 USAGE COUNTERS (SAFE + LAZY IMPORTS)
====================================================== */
async function getUsageCount(key, hospitalId) {
  switch (key) {
    case "users": {
      const { default: User } = await import("../models/User.js");
      return User.countDocuments({
        hospital: hospitalId,
        active: true,
      });
    }

    case "patients": {
      const { default: Patient } = await import("../models/Patient.js");
      return Patient.countDocuments({
        hospital: hospitalId,
        active: true,
      });
    }

    default:
      return 0; // unknown limit → do not block
  }
  }
