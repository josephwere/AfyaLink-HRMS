import Hospital from "../models/Hospital.js";
import { notifyRolesInHospital } from "./notificationService.js";

function toNumber(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMilestones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

function deriveBillingState(hospital, now = new Date()) {
  const billing = hospital?.billing || {};
  const monthlyTarget = toNumber(billing.monthlyTarget, 0);
  const monthlySpent = toNumber(billing.monthlySpent, 0);
  const balanceOutstanding = toNumber(billing.balanceOutstanding, 0);
  const paymentDueAt = billing.paymentDueAt ? new Date(billing.paymentDueAt) : null;
  const thresholds = normalizeMilestones(billing.alertThresholds).length
    ? normalizeMilestones(billing.alertThresholds)
    : [50, 70, 80, 90, 100, 110, 125];
  const alertedMilestones = normalizeMilestones(billing.alertedMilestones);
  const percentage = monthlyTarget > 0 ? Math.round((monthlySpent / monthlyTarget) * 100) : 0;
  const targetExceeded = monthlyTarget > 0 && monthlySpent > monthlyTarget;
  const milestonesTriggered = thresholds.filter((threshold) => percentage >= threshold);
  const pendingMilestones = milestonesTriggered.filter((threshold) => !alertedMilestones.includes(threshold));

  let status = "CURRENT";
  if (balanceOutstanding > 0) {
    if (paymentDueAt && now > paymentDueAt) {
      const ageDays = Math.max(0, Math.floor((now.getTime() - paymentDueAt.getTime()) / (24 * 60 * 60 * 1000)));
      status = ageDays >= 30 ? "SERIOUSLY_OVERDUE" : ageDays >= 7 ? "OVERDUE" : "PAYMENT_DUE";
    } else {
      status = "PAYMENT_DUE";
    }
  }

  return {
    status,
    monthlyTarget,
    monthlySpent,
    balanceOutstanding,
    budgetProgress: {
      target: monthlyTarget,
      spent: monthlySpent,
      percentage,
      remaining: Math.max(0, monthlyTarget - monthlySpent),
    },
    targetExceeded,
    milestonesTriggered,
    pendingMilestones,
    alertedMilestones,
    restrictPremiumFeatures: status !== "CURRENT" || targetExceeded || Boolean(hospital?.subscription?.premiumPaused),
  };
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

export function buildBillingMilestoneNotifications(hospital, now = new Date()) {
  const state = typeof hospital?.getBillingState === "function"
    ? hospital.getBillingState(now)
    : deriveBillingState(hospital, now);
  const billing = hospital?.billing || {};
  const target = toNumber(billing.monthlyTarget, 0);
  const spent = toNumber(billing.monthlySpent, 0);
  const balanceOutstanding = toNumber(billing.balanceOutstanding, 0);

  return (state.pendingMilestones || []).map((milestone) => ({
    title: `${hospital?.name || "Hospital"} reached ${milestone}% of its monthly budget`,
    body: `${hospital?.name || "Hospital"} has reached ${milestone}% of its monthly budget (${formatCurrency(spent)} of ${formatCurrency(target)}). Core hospital operations remain available. ${milestone >= 100 ? "Additional premium usage will continue on a pay-as-you-go basis." : "If you want to stay within plan, consider reducing premium AI or messaging usage."} ${balanceOutstanding > 0 ? `There is also an outstanding balance of ${formatCurrency(balanceOutstanding)}.` : "No outstanding balance is currently due."}`,
    category: "BILLING",
    hospital: hospital?._id || null,
    meta: {
      type: "HOSPITAL_BILLING_MILESTONE",
      milestone,
      status: state.status,
      budgetProgress: state.budgetProgress,
    },
  }));
}

export function buildMonthlySummaryNotification(hospital, now = new Date()) {
  const state = typeof hospital?.getBillingState === "function"
    ? hospital.getBillingState(now)
    : deriveBillingState(hospital, now);
  const billing = hospital?.billing || {};
  const target = toNumber(billing.monthlyTarget, 0);
  const spent = toNumber(billing.monthlySpent, 0);
  const balanceOutstanding = toNumber(billing.balanceOutstanding, 0);
  const isOverTarget = state.targetExceeded || spent > target;
  const title = `End-of-month billing summary for ${hospital?.name || "Hospital"}`;
  const body = `${hospital?.name || "Hospital"} finished the month at ${state.budgetProgress?.percentage || 0}% of its budget (${formatCurrency(spent)} of ${formatCurrency(target)}). ${isOverTarget ? `Spend exceeded the target by ${formatCurrency(Math.max(0, spent - target))}. Core services remained available while premium usage was billed on a pay-as-you-go basis.` : "Spend stayed within the target. Great financial management. Core services remained available."} ${balanceOutstanding > 0 ? `There is also an outstanding balance of ${formatCurrency(balanceOutstanding)}.` : "No outstanding balance is due."}`;

  return {
    title,
    body,
    category: "BILLING",
    hospital: hospital?._id || null,
    meta: {
      type: "HOSPITAL_BILLING_SUMMARY",
      status: state.status,
      budgetProgress: state.budgetProgress,
      targetExceeded: state.targetExceeded,
      now,
    },
  };
}

async function defaultNotifier(payload) {
  if (!payload?.hospital) return null;
  return notifyRolesInHospital({
    hospital: payload.hospital,
    roles: ["HOSPITAL_ADMIN", "SUPER_ADMIN"],
    title: payload.title,
    body: payload.body,
    category: payload.category,
    meta: payload.meta,
  });
}

export async function dispatchBillingMilestoneNotifications({ hospital, now = new Date(), notifier = defaultNotifier } = {}) {
  const notifications = buildBillingMilestoneNotifications(hospital, now);
  if (!notifications.length) return [];

  const results = [];
  for (const payload of notifications) {
    const result = await notifier(payload);
    results.push(result);
  }

  if (hospital?._id) {
    const existing = Array.isArray(hospital?.billing?.alertedMilestones)
      ? hospital.billing.alertedMilestones
      : [];
    const next = [...new Set([...existing, ...notifications.map((item) => Number(item.meta?.milestone)).filter(Number.isFinite)])];
    await Hospital.updateOne(
      { _id: hospital._id },
      {
        $set: {
          "billing.alertedMilestones": next,
          "billing.lastNotificationSentAt": now,
        },
      }
    ).catch(() => {});
  }

  return results;
}

export async function dispatchMonthlySummaryNotifications({ hospital, now = new Date(), notifier = defaultNotifier } = {}) {
  const billing = hospital?.billing || {};
  const lastSentAt = billing.lastSummarySentAt ? new Date(billing.lastSummarySentAt) : null;
  const sameMonth = lastSentAt && lastSentAt.getFullYear() === now.getFullYear() && lastSentAt.getMonth() === now.getMonth();
  if (sameMonth) return null;

  const payload = buildMonthlySummaryNotification(hospital, now);
  const result = await notifier(payload);

  if (hospital?._id) {
    await Hospital.updateOne(
      { _id: hospital._id },
      {
        $set: {
          "billing.lastSummarySentAt": now,
        },
      }
    ).catch(() => {});
  }

  return result;
}

export async function dispatchHospitalBillingNotifications({ hospitals = [], now = new Date() } = {}) {
  const results = [];
  for (const hospital of hospitals) {
    const milestoneResults = await dispatchBillingMilestoneNotifications({ hospital, now });
    const monthlySummaryResult = await dispatchMonthlySummaryNotifications({ hospital, now });
    results.push({ hospital: hospital?._id || null, milestoneResults, monthlySummaryResult });
  }
  return results;
}
