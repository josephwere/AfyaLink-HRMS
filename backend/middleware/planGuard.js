import Hospital from "../models/Hospital.js";
import { denyAudit } from "./denyAudit.js";
import { isBreakGlassActive } from "./breakGlassGuard.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

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

      const [hospital, systemSettings] = await Promise.all([
        Hospital.findOne({
        _id: hospitalId,
        active: true,
      }).lean(),
        getSystemSettingsDoc({ lean: true }),
      ]);

      if (!hospital) {
        return res.status(403).json({
          message: "Hospital inactive or not found",
        });
      }

      const premiumFeatures = new Set([
        "ai",
        "payments",
        "realtime",
        "auditLogs",
        "adminCreation",
        "lab",
        "pharmacy",
        "inventory",
        "advertising",
        "recruitmentAds",
        "advancedAnalytics",
        "heavyExports",
      ]);
      const monetization = systemSettings?.monetization || {};
      const featureAccess =
        (typeof monetization.featureAccess?.toObject === "function"
          ? monetization.featureAccess.toObject()
          : monetization.featureAccess) || {};
      const now = new Date();
      const subStatus = hospital?.subscription?.status || "TRIAL";
      const trialEndsAt = hospital?.subscription?.trialEndsAt
        ? new Date(hospital.subscription.trialEndsAt)
        : null;
      const trialExpired = trialEndsAt ? now > trialEndsAt : false;
      const paid = Boolean(hospital?.subscription?.paid) || subStatus === "ACTIVE";
      const premiumPaused =
        Boolean(hospital?.subscription?.premiumPaused) || (trialExpired && !paid);
      if (trialExpired && !paid && !hospital?.subscription?.premiumPaused) {
        await Hospital.updateOne(
          { _id: hospitalId },
          {
            $set: {
              "subscription.status": "PAUSED",
              "subscription.premiumPaused": true,
            },
          }
        ).catch(() => {});
      } else if (paid && (hospital?.subscription?.premiumPaused || subStatus !== "ACTIVE")) {
        await Hospital.updateOne(
          { _id: hospitalId },
          {
            $set: {
              "subscription.status": "ACTIVE",
              "subscription.premiumPaused": false,
            },
          }
        ).catch(() => {});
      }

      /* ================= FEATURE CHECK ================= */
      if (feature) {
        const tier = String(featureAccess[feature] || (premiumFeatures.has(feature) ? "PREMIUM" : "FREE"))
          .toUpperCase();
        if (premiumPaused && tier === "PREMIUM") {
          await denyAudit(req, res, `Premium feature '${feature}' blocked due to expired trial`);
          return res.status(402).json({
            message: "Hospital premium trial expired. Premium features are paused until payment.",
            code: "PREMIUM_PAUSED",
          });
        }
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
        if (monetization.enforceUsageLimits !== true) {
          return next();
        }
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
