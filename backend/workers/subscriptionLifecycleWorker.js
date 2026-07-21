import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import { notifyRolesInHospital } from "../services/notificationService.js";

const TRIAL_WARNING_WINDOWS = [
  { days: 30, tag: "trial_30d", label: "about 1 month" },
  { days: 14, tag: "trial_14d", label: "about 2 weeks" },
  { days: 7, tag: "trial_7d", label: "about 1 week" },
];

function getDaysLeft(trialEndsAt, now = new Date()) {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

async function notifyHospitalRoles({ hospitalId, title, body, category, meta = {} }) {
  const users = await User.find({
    hospital: hospitalId,
    role: { $in: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"] },
    active: true,
  })
    .select("_id")
    .lean();

  if (!users.length) return 0;

  await notifyRolesInHospital({
    hospital: hospitalId,
    roles: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"],
    title,
    body,
    category,
    meta,
  });

  return users.length;
}

export async function runSubscriptionLifecycleSweep() {
  const now = new Date();
  const hospitals = await Hospital.find({ active: true }).select(
    "name subscription"
  );

  let updated = 0;
  let remindersSent = 0;
  for (const h of hospitals) {
    h.subscription = h.subscription || {};
    h.subscription.reminderTagsSent = Array.isArray(h.subscription.reminderTagsSent)
      ? h.subscription.reminderTagsSent
      : [];

    const trialEndsAt = h.subscription.trialEndsAt
      ? new Date(h.subscription.trialEndsAt)
      : null;
    const trialExpired = trialEndsAt ? now > trialEndsAt : false;
    const paid = Boolean(h.subscription.paid);
    const daysLeft = getDaysLeft(trialEndsAt, now);

    const prevStatus = h.subscription.status;
    const prevPaused = Boolean(h.subscription.premiumPaused);
    const prevTags = [...h.subscription.reminderTagsSent];

    if (paid) {
      h.subscription.status = "ACTIVE";
      h.subscription.premiumPaused = false;
    } else if (trialExpired) {
      h.subscription.status = "PAUSED";
      h.subscription.premiumPaused = true;
    } else {
      h.subscription.status = "TRIAL";
      h.subscription.premiumPaused = false;
    }

    if (!paid && h.subscription.status === "TRIAL") {
      const hasStartTag = h.subscription.reminderTagsSent.includes("trial_started");
      if (!hasStartTag) {
        const sent = await notifyHospitalRoles({
          hospitalId: h._id,
          title: "Free Trial Started",
          body: `${h.name} is now on a 3-month free trial. Premium features are active during trial.`,
          category: "SUBSCRIPTION",
          meta: { type: "TRIAL_STARTED", trialEndsAt: h.subscription.trialEndsAt },
        });
        if (sent > 0) remindersSent += sent;
        h.subscription.reminderTagsSent.push("trial_started");
      }

      for (const window of TRIAL_WARNING_WINDOWS) {
        if (daysLeft === null) break;
        const alreadySent = h.subscription.reminderTagsSent.includes(window.tag);
        if (!alreadySent && daysLeft <= window.days) {
          const sent = await notifyHospitalRoles({
            hospitalId: h._id,
            title: "Free Trial Ending Soon",
            body: `${h.name} free trial ends in ${window.label}. Upgrade to keep premium features active.`,
            category: "SUBSCRIPTION",
            meta: {
              type: "TRIAL_ENDING",
              thresholdDays: window.days,
              daysLeft,
              trialEndsAt: h.subscription.trialEndsAt,
            },
          });
          if (sent > 0) remindersSent += sent;
          h.subscription.reminderTagsSent.push(window.tag);
        }
      }
    }

    if (
      prevStatus !== h.subscription.status ||
      prevPaused !== Boolean(h.subscription.premiumPaused) ||
      prevTags.length !== h.subscription.reminderTagsSent.length
    ) {
      await h.save();
      updated += 1;
    }
  }

  return { scanned: hospitals.length, updated, remindersSent };
}
