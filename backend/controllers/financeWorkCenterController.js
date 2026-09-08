import CashierShift from "../models/CashierShift.js";
import Notification from "../models/Notification.js";
import PaymentReceipt from "../models/PaymentReceipt.js";
import Financial from "../models/Financial.js";
import JournalEntry from "../models/JournalEntry.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function getHospitalId(req) {
  return req.user?.hospital || req.user?.hospitalId || null;
}

const FINANCE_ROLES = new Set(["ACCOUNTANT", "FINANCE_MANAGER", "CFO", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);

function isFinance(role) {
  return FINANCE_ROLES.has(normalizeRole(role));
}

export const getWorkCenter = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const role = normalizeRole(req.user?.role);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const [shiftApprovals, notifications, revenueTodayAgg, outstandingBills, refundsToday, cashVarianceAgg, pendingClaims] = await Promise.all([
    CashierShift.countDocuments({ hospital: hospitalId, status: "UNDER_REVIEW" }),
    Notification.find({ hospital: hospitalId }).sort({ createdAt: -1 }).limit(20).lean(),
    PaymentReceipt.aggregate([
      { $match: { hospitalId: hospitalId, receivedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Financial.countDocuments({ hospital: hospitalId, status: "Pending" }),
    JournalEntry.countDocuments({ hospitalId: hospitalId, entryType: "REFUND", postedAt: { $gte: start, $lte: end } }),
    CashierShift.aggregate([
      { $match: { hospital: hospitalId, updatedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, avgVariance: { $avg: "$variance" }, totalVariance: { $sum: "$variance" } } },
    ]),
    Financial.countDocuments({ hospital: hospitalId, "insuranceClaim.claimId": { $exists: true }, "insuranceClaim.status": { $ne: "PAID" } }),
  ]);

  // fetch up to 10 pending shift items for inline actions
  const pendingShifts = await CashierShift.find({ hospital: hospitalId, status: "UNDER_REVIEW" })
    .sort({ submittedAt: -1 })
    .limit(10)
    .lean();

  const revenueToday = (revenueTodayAgg && revenueTodayAgg[0] && revenueTodayAgg[0].total) || 0;
  const cashVariance = (cashVarianceAgg && cashVarianceAgg[0]) || { avgVariance: 0, totalVariance: 0 };

  const approvalQueue = {
    shiftApprovals: Number(shiftApprovals || 0),
    refundApprovals: 0,
    journalApprovals: 0,
    consolidationApprovals: 0,
  };

  const kpis = {
    revenueToday,
    outstandingBills: Number(outstandingBills || 0),
    collectionsToday: revenueToday,
    refundsToday: Number(refundsToday || 0),
    cashVariance: cashVariance,
    pendingClaims: Number(pendingClaims || 0),
  };

  const tasks = [];
  if (isFinance(role)) {
    tasks.push({ key: "approve_shift", label: "Approve Shift" });
    tasks.push({ key: "review_refund", label: "Review Refund" });
    tasks.push({ key: "approve_journal", label: "Approve Journal" });
    tasks.push({ key: "publish_consolidation", label: "Publish Consolidation" });
    tasks.push({ key: "close_period", label: "Close Accounting Period" });
  } else {
    tasks.push({ key: "view_tasks", label: "View Finance Tasks" });
  }

  return res.json({ approvalQueue, notifications, tasks, kpis, pendingShifts });
};
