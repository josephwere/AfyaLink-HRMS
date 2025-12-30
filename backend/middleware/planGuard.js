import Hospital from "../models/Hospital.js";
import Subscription from "../models/Subscription.js";
import { denyAudit } from "./denyAudit.js";

/**
 * PLAN + LIMIT + FEATURE ENFORCEMENT
 */
export const planGuard =
  ({ feature, limitKey }) =>
  async (req, res, next) => {
    try {
      const hospitalId = req.user.hospitalId;
      if (!hospitalId) return next();

      const hospital = await Hospital.findById(hospitalId).lean();
      if (!hospital || !hospital.active) {
        return res.status(403).json({ message: "Hospital inactive" });
      }

      const subscription = await Subscription.findOne({
        hospital: hospitalId,
        status: "ACTIVE",
      })
        .populate("plan")
        .lean();

      if (!subscription || !subscription.plan) {
        return res.status(403).json({
          message: "No active subscription",
        });
      }

      const plan = subscription.plan;

      /* ================= FEATURE CHECK ================= */
      if (feature && !plan.features?.[feature]) {
        await denyAudit(
          req,
          res,
          `Feature '${feature}' blocked by plan`
        );

        return res.status(402).json({
          message: "Upgrade plan to access this feature",
        });
      }

      /* ================= LIMIT CHECK ================= */
      if (limitKey) {
        const current = await getUsageCount(limitKey, hospitalId);
        const allowed = plan.limits?.[limitKey];

        if (allowed !== undefined && current >= allowed) {
          return res.status(402).json({
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
    case "users":
      return (
        await import("../models/User.js")
      ).default.countDocuments({
        hospital: hospitalId,
        active: true,
      });

    case "patients":
      return (
        await import("../models/Patient.js")
      ).default.countDocuments({
        hospital: hospitalId,
        active: true,
      });

    default:
      return 0;
  }
}
