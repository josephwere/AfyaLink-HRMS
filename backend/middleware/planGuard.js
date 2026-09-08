import Hospital from "../models/Hospital.js";
import mongoose from "mongoose";
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
          ...(mongoose.isValidObjectId(hospitalId)
            ? { _id: hospitalId }
            : { $or: [{ hospitalId }, { code: hospitalId }] }),
          active: true,
        }).lean(),
        getSystemSettingsDoc({ lean: true }),
      ]);

      if (!hospital) {
        if (!mongoose.isValidObjectId(hospitalId)) {
          return next();
        }

        const privilegedRole = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(
          String(req.user?.role || "").toUpperCase()
        );
        if (privilegedRole) {
          return next();
        }

        return res.status(403).json({
          message: "Hospital inactive or not found",
        });
      }

      const coreFeatures = new Set([
        "payments",
        "pharmacy",
        "inventory",
        "lab",
        "realtime",
      ]);
      const premiumFeatures = new Set([
        "ai",
        "advertising",
        "recruitmentAds",
        "advancedAnalytics",
        "heavyExports",
      ]);
      const billing = hospital?.billing || {};
      const monthlyTarget = Number(billing.monthlyTarget || 0);
      const monthlySpent = Number(billing.monthlySpent || 0);
      const balanceOutstanding = Number(billing.balanceOutstanding || 0);
      const paymentDueAt = billing.paymentDueAt ? new Date(billing.paymentDueAt) : null;
      const thresholds = Array.isArray(billing.alertThresholds) && billing.alertThresholds.length
        ? billing.alertThresholds
        : [50, 70, 80, 90, 100, 110, 125];
      const percentage = monthlyTarget > 0 ? Math.round((monthlySpent / monthlyTarget) * 100) : 0;
      const targetExceeded = monthlyTarget > 0 && monthlySpent > monthlyTarget;
      let billingStatus = "CURRENT";
      if (balanceOutstanding > 0) {
        if (paymentDueAt && now > paymentDueAt) {
          const ageDays = Math.max(0, Math.floor((now.getTime() - paymentDueAt.getTime()) / (24 * 60 * 60 * 1000)));
          billingStatus = ageDays >= 30 ? "SERIOUSLY_OVERDUE" : ageDays >= 7 ? "OVERDUE" : "PAYMENT_DUE";
        } else {
          billingStatus = "PAYMENT_DUE";
        }
      }
      const restrictPremiumFeatures = billingStatus !== "CURRENT" || targetExceeded || Boolean(hospital?.subscription?.premiumPaused);
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
          { _id: hospital._id },
          {
            $set: {
              "subscription.status": "PAUSED",
              "subscription.premiumPaused": true,
            },
          }
        ).catch(() => {});
      } else if (paid && (hospital?.subscription?.premiumPaused || subStatus !== "ACTIVE")) {
        await Hospital.updateOne(
          { _id: hospital._id },
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
        if (coreFeatures.has(feature)) {
          return next();
        }

        const tier = String(featureAccess[feature] || (premiumFeatures.has(feature) ? "PREMIUM" : "FREE"))
          .toUpperCase();
        if ((premiumPaused || restrictPremiumFeatures) && tier === "PREMIUM") {
          await denyAudit(req, res, `Premium feature '${feature}' blocked by billing policy`);
          return res.status(402).json({
            message: restrictPremiumFeatures
              ? "Hospital billing is currently past due or over target; only premium modules are temporarily restricted while core clinical services remain available."
              : "Hospital premium trial expired. Premium features are paused until payment while core services remain available.",
            code: restrictPremiumFeatures ? "PREMIUM_RESTRICTED" : "PREMIUM_PAUSED",
            billingState: {
              status: billingStatus,
              percentage,
              targetExceeded,
              milestonesTriggered: thresholds.filter((threshold) => percentage >= threshold),
            },
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
          const current = await getUsageCount(limitKey, hospital._id);

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
