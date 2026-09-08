import CashierShift from "../models/CashierShift.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { logAudit } from "../services/auditService.js";
import { notifyRolesInHospital } from "../services/notificationService.js";

const CASHIER_ROLES = new Set([
  "RECEPTIONIST",
  "PAYROLL_OFFICER",
  "CASHIER",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
]);
const FINANCE_APPROVER_ROLES = new Set([
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "CFO",
  "HOSPITAL_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
]);

function getHospitalId(req) {
  return req.user?.hospital || req.user?.hospitalId || null;
}

function isFinanceApprover(role) {
  return FINANCE_APPROVER_ROLES.has(normalizeRole(role));
}

function isCashierOperator(role) {
  return CASHIER_ROLES.has(normalizeRole(role));
}

export const getCurrentShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const role = normalizeRole(req.user?.role);
  const cashierId = req.query?.cashierId;
  if (cashierId && !isFinanceApprover(role) && String(cashierId).trim() !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden: cannot access another cashier's shift" });
  }

  const query = { hospital: hospitalId, status: { $in: ["OPEN", "IN_PROGRESS", "CLOSED_BY_CASHIER", "UNDER_REVIEW", "REJECTED"] } };
  if (cashierId) {
    query.cashier = String(cashierId).trim();
  } else if (!isFinanceApprover(role)) {
    query.cashier = req.user._id;
  }

  const shift = await CashierShift.findOne(query).sort({ updatedAt: -1 }).lean();
  return res.json(shift || null);
};

export const listShifts = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const role = normalizeRole(req.user?.role);
  const cashierId = req.query?.cashierId;
  const status = req.query?.status;
  const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);

  if (cashierId && !isFinanceApprover(role) && String(cashierId).trim() !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden: cannot access another cashier's shift" });
  }

  const query = { hospital: hospitalId };
  if (cashierId) query.cashier = String(cashierId).trim();
  else if (!isFinanceApprover(role)) query.cashier = req.user._id;
  if (status) {
    query.status = String(status).trim();
    if (query.status === "PENDING_APPROVAL") {
      query.status = "UNDER_REVIEW";
    }
  }

  const items = await CashierShift.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
  return res.json(items);
};

export const getShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const role = normalizeRole(req.user?.role);
  const { id } = req.params;
  const shift = await CashierShift.findOne({ _id: id, hospital: hospitalId }).lean();
  if (!shift) return res.status(404).json({ message: "Shift not found" });

  if (!isFinanceApprover(role) && String(shift.cashier) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden: cannot access another cashier's shift" });
  }

  return res.json(shift);
};

export const createShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const existing = await CashierShift.findOne({
    hospital: hospitalId,
    cashier: req.user._id,
    status: { $in: ["OPEN", "IN_PROGRESS", "CLOSED_BY_CASHIER", "UNDER_REVIEW"] },
  });
  if (existing) {
    return res.status(409).json({ message: "A shift is already active or awaiting approval" });
  }

  const openingFloat = Number(req.body.openingFloat || 0);
  const openingTime = req.body.openingTime ? new Date(req.body.openingTime) : new Date();

  const shift = await CashierShift.create({
    hospital: hospitalId,
    cashier: req.user._id,
    cashierName: req.user?.name || req.user?.email || "",
    openingFloat,
    openingTime,
    openedAt: new Date(),
    status: "OPEN",
  });

  return res.status(201).json(shift);
};

export const closeShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const { id } = req.params;
  const shift = await CashierShift.findOne({ _id: id, hospital: hospitalId });
  if (!shift) return res.status(404).json({ message: "Shift not found" });

  if (String(shift.cashier) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden: only the owning cashier can close this shift" });
  }

  if (shift.status === "APPROVED") {
    return res.status(400).json({ message: "Shift has already been approved and closed" });
  }
  if (shift.status === "UNDER_REVIEW" || shift.status === "CLOSED_BY_CASHIER") {
    return res.status(400).json({ message: "Shift closure already submitted for approval" });
  }

  const counts = req.body?.counts || {};
  const expectedTotal = Number(req.body.expectedTotal || 0);
  const actualTotal = Number(req.body.actualTotal || 0);
  const variance = Number(req.body.variance || actualTotal - expectedTotal);

  shift.counts = counts;
  shift.expectedTotal = expectedTotal;
  shift.actualTotal = actualTotal;
  shift.variance = variance;
  shift.reason = String(req.body.reason || "");
  shift.notes = String(req.body.notes || "");
  // Mark closed by cashier then submit for review
  shift.status = "CLOSED_BY_CASHIER";
  shift.closedByCashierAt = new Date();
  shift.submittedAt = new Date();
  shift.rejectionReason = "";
  shift.rejectedBy = undefined;
  shift.rejectedAt = undefined;

  // transition to review state
  shift.status = "UNDER_REVIEW";

  await shift.save();

  // audit and notify finance roles
  try {
    await logAudit({
      req,
      action: "SHIFT_SUBMITTED_FOR_REVIEW",
      resource: "CashierShift",
      resourceId: shift._id,
      after: shift,
      hospital: shift.hospital,
      actorId: req.user._id,
      actorRole: req.user.role,
    });
  } catch (e) {}

  try {
    await notifyRolesInHospital({
      hospital: hospitalId,
      roles: ["ACCOUNTANT", "FINANCE_MANAGER", "CFO"],
      title: "Shift awaiting approval",
      body: `Shift closed by ${shift.cashierName || "cashier"} awaiting approval`,
      meta: { shiftId: String(shift._id) },
    });
  } catch (e) {}

  // create a unified work item for the approval inbox
  try {
    const { createWorkItem } = await import("../services/workflowService.js");
    await createWorkItem({
      hospital: hospitalId,
      type: "SHIFT_APPROVAL",
      module: "finance",
      priority: "HIGH",
      createdBy: req.user._id,
      metadata: {
        shiftId: String(shift._id),
        branch: req.user?.employment?.branch || null,
        department: req.user?.employment?.department || null,
      },
      actionUrl: `/app/finance/approvals/${shift._id}`,
    });
  } catch (e) {}

  return res.json(shift);
};

export const approveShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const { id } = req.params;
  const shift = await CashierShift.findOne({ _id: id, hospital: hospitalId });
  if (!shift) return res.status(404).json({ message: "Shift not found" });
  if (shift.status !== "UNDER_REVIEW" && shift.status !== "CLOSED_BY_CASHIER") {
    return res.status(400).json({ message: "Shift is not awaiting approval" });
  }
  if (String(shift.cashier) === String(req.user._id)) {
    return res.status(403).json({ message: "Approver must be different from the cashier" });
  }

  shift.status = "APPROVED";
  shift.approvedBy = req.user._id;
  shift.approvedAt = new Date();
  shift.lockedAt = new Date();
  await shift.save();

  try {
    await logAudit({
      req,
      action: "SHIFT_APPROVED",
      resource: "CashierShift",
      resourceId: shift._id,
      after: shift,
      hospital: shift.hospital,
      actorId: req.user._id,
      actorRole: req.user.role,
    });
  } catch (e) {}

  try {
    await notifyRolesInHospital({
      hospital: hospitalId,
      roles: ["HOSPITAL_ADMIN", "FINANCE_MANAGER"],
      title: "Shift approved",
      body: `Shift ${String(shift._id)} approved by ${req.user?.name || req.user?.email}`,
      meta: { shiftId: String(shift._id) },
    });
  } catch (e) {}

  // TODO: enqueue end-of-day summary and journal posting effects

  return res.json(shift);
};

export const rejectShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const { id } = req.params;
  const { reason } = req.body || {};

  const shift = await CashierShift.findOne({ _id: id, hospital: hospitalId });
  if (!shift) return res.status(404).json({ message: "Shift not found" });
  if (shift.status !== "UNDER_REVIEW" && shift.status !== "CLOSED_BY_CASHIER") {
    return res.status(400).json({ message: "Shift is not awaiting approval" });
  }
  if (String(shift.cashier) === String(req.user._id)) {
    return res.status(403).json({ message: "Approver must be different from the cashier" });
  }

  shift.status = "REJECTED";
  shift.rejectionReason = String(reason || "Rejected");
  shift.rejectedBy = req.user._id;
  shift.rejectedAt = new Date();
  await shift.save();

  try {
    await logAudit({
      req,
      action: "SHIFT_REJECTED",
      resource: "CashierShift",
      resourceId: shift._id,
      after: shift,
      hospital: shift.hospital,
      actorId: req.user._id,
      actorRole: req.user.role,
    });
  } catch (e) {}

  try {
    await notifyRolesInHospital({
      hospital: hospitalId,
      roles: ["HOSPITAL_ADMIN"],
      title: "Shift rejected",
      body: `Shift closed by ${shift.cashierName || "cashier"} was rejected: ${shift.rejectionReason}`,
      meta: { shiftId: String(shift._id) },
    });
  } catch (e) {}

  return res.json(shift);
};

export const reopenShift = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });

  const { id } = req.params;
  const shift = await CashierShift.findOne({ _id: id, hospital: hospitalId });
  if (!shift) return res.status(404).json({ message: "Shift not found" });

  // allow cashier to reopen if rejected
  if (String(shift.cashier) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden: only owning cashier may reopen after rejection" });
  }
  if (shift.status !== "REJECTED") {
    return res.status(400).json({ message: "Shift is not in a rejected state" });
  }

  shift.status = "REOPENED";
  shift.rejectionReason = "";
  shift.rejectedBy = undefined;
  shift.rejectedAt = undefined;
  await shift.save();

  try {
    await logAudit({
      req,
      action: "SHIFT_REOPENED",
      resource: "CashierShift",
      resourceId: shift._id,
      after: shift,
      hospital: shift.hospital,
      actorId: req.user._id,
      actorRole: req.user.role,
    });
  } catch (e) {}

  return res.json(shift);
};
