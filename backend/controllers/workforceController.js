import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import WorkflowSlaPolicy from "../models/WorkflowSlaPolicy.js";
import WorkflowAutomationPolicy from "../models/WorkflowAutomationPolicy.js";
import WorkflowAutomationPreset from "../models/WorkflowAutomationPreset.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import {
  WORKFORCE_REQUEST_TYPES,
  WORKFORCE_SLA_DEFAULTS,
} from "../constants/workforceSLA.js";
import { logAudit } from "../services/auditService.js";

function getHospitalId(req) {
  return req.user?.hospital || req.user?.hospitalId;
}

function parseListArgs(req, defaultLimit = 25) {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || String(defaultLimit), 10), 1), 100);
  const cursor = req.query.cursor || null;
  const cursorMode =
    req.query.cursorMode === "1" ||
    req.query.cursorMode === "true" ||
    Object.prototype.hasOwnProperty.call(req.query, "cursor");
  const wantsPaged = Boolean(req.query.page || req.query.limit || req.query.cursor);
  return { page, limit, cursor, wantsPaged, cursorMode };
}

async function listRequests({ req, res, model, filter, populate }) {
  const { page, limit, cursor, wantsPaged, cursorMode } = parseListArgs(req);

  // Backward-compatible mode for existing frontend expecting raw arrays
  if (!wantsPaged) {
    const q = model.find(filter).sort({ createdAt: -1 }).limit(500);
    if (populate) q.populate(populate);
    const items = await q;
    return res.json(items);
  }

  if (cursorMode) {
    let cursorFilter = { ...filter };
    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      cursorFilter = {
        ...filter,
        $or: [
          { createdAt: { $lt: new Date(parsed.createdAt) } },
          { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
        ],
      };
    }
    const q = model.find(cursorFilter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
    if (populate) q.populate(populate);
    const rows = await q;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
      : null;
    return res.json({ items, nextCursor, hasMore, limit });
  }

  const [items, total] = await Promise.all([
    (populate
      ? model
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate(populate)
      : model
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)),
    model.countDocuments(filter),
  ]);
  return res.json({ items, total, page, limit });
}

async function notifyHospitalAdmins({ hospitalId, title, body, meta, category }) {
  if (!hospitalId) return;
  const admins = await User.find({ hospital: hospitalId, role: "HOSPITAL_ADMIN" })
    .select("_id")
    .lean();

  if (!admins.length) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      title,
      body,
      user: admin._id,
      hospital: hospitalId,
      meta,
      category: category || "SYSTEM",
    }))
  );
}

async function getSlaPolicy(hospitalId, requestType) {
  const stored = await WorkflowSlaPolicy.findOne({
    hospital: hospitalId,
    requestType,
    active: true,
  })
    .lean()
    .select("targetMinutes escalationMinutes active");
  if (stored) return stored;
  return WORKFORCE_SLA_DEFAULTS[requestType] || null;
}

async function computeSlaDates(hospitalId, requestType, createdAt = new Date()) {
  const policy = await getSlaPolicy(hospitalId, requestType);
  if (!policy?.active) return { policy, slaDueAt: null };
  const due = new Date(createdAt.getTime() + policy.targetMinutes * 60 * 1000);
  return { policy, slaDueAt: due };
}

function normalizeRequestType(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

const WORKFORCE_AUTOMATION_DEFAULTS = {
  LEAVE: {
    requestType: "LEAVE",
    active: true,
    autoApprove: false,
    requireSecondApprover: false,
    fallbackRole: "HOSPITAL_ADMIN",
    escalationAfterMinutes: 120,
    conditions: {
      maxLeaveDays: 1,
      maxOvertimeHours: 0,
      priorityAgeMultiplier: 1,
      priorityWeightCap: 5,
      allowedShiftTypes: [],
      fallbackCandidates: ["HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"],
    },
  },
  OVERTIME: {
    requestType: "OVERTIME",
    active: true,
    autoApprove: false,
    requireSecondApprover: false,
    fallbackRole: "HOSPITAL_ADMIN",
    escalationAfterMinutes: 120,
    conditions: {
      maxLeaveDays: 0,
      maxOvertimeHours: 2,
      priorityAgeMultiplier: 1,
      priorityWeightCap: 5,
      allowedShiftTypes: [],
      fallbackCandidates: ["HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"],
    },
  },
  SHIFT: {
    requestType: "SHIFT",
    active: true,
    autoApprove: false,
    requireSecondApprover: false,
    fallbackRole: "HOSPITAL_ADMIN",
    escalationAfterMinutes: 120,
    conditions: {
      maxLeaveDays: 0,
      maxOvertimeHours: 0,
      priorityAgeMultiplier: 1,
      priorityWeightCap: 5,
      allowedShiftTypes: ["DAY"],
      fallbackCandidates: ["HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"],
    },
  },
};

const WORKFORCE_AUTOMATION_PRESETS = {
  CONSERVATIVE: {
    key: "CONSERVATIVE",
    name: "Conservative",
    description: "Higher control with faster escalation and mandatory second approval.",
    config: {
      active: true,
      autoApprove: false,
      requireSecondApprover: true,
      fallbackRole: "HOSPITAL_ADMIN",
      escalationAfterMinutes: 60,
      conditions: {
        priorityAgeMultiplier: 1.5,
        priorityWeightCap: 8,
      },
    },
  },
  BALANCED: {
    key: "BALANCED",
    name: "Balanced",
    description: "Balanced governance with workload-aware fallback routing.",
    config: {
      active: true,
      autoApprove: false,
      requireSecondApprover: true,
      fallbackRole: "AUTO",
      escalationAfterMinutes: 120,
      conditions: {
        priorityAgeMultiplier: 1,
        priorityWeightCap: 5,
      },
    },
  },
  AGGRESSIVE: {
    key: "AGGRESSIVE",
    name: "Aggressive",
    description: "Fast throughput with auto-approval and high urgency weighting.",
    config: {
      active: true,
      autoApprove: true,
      requireSecondApprover: false,
      fallbackRole: "AUTO",
      escalationAfterMinutes: 30,
      conditions: {
        priorityAgeMultiplier: 2,
        priorityWeightCap: 10,
      },
    },
  },
};

async function getAutomationPolicy(hospitalId, requestType) {
  const found = await WorkflowAutomationPolicy.findOne({
    hospital: hospitalId,
    requestType,
    active: true,
  })
    .lean()
    .select("requestType active autoApprove requireSecondApprover fallbackRole escalationAfterMinutes conditions");
  if (found) return found;
  return WORKFORCE_AUTOMATION_DEFAULTS[requestType] || null;
}

const FALLBACK_ROLES = new Set([
  "HOSPITAL_ADMIN",
  "SYSTEM_ADMIN",
  "SUPER_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
]);

function normalizeFallbackCandidates(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v || "").toUpperCase().trim())
    .filter((v, idx, arr) => v && FALLBACK_ROLES.has(v) && arr.indexOf(v) === idx);
}

function normalizePriorityTuning(conditions = {}) {
  const ageMultiplierRaw = Number(conditions?.priorityAgeMultiplier);
  const weightCapRaw = Number(conditions?.priorityWeightCap);

  const priorityAgeMultiplier = Number.isFinite(ageMultiplierRaw) ? ageMultiplierRaw : 1;
  const priorityWeightCap = Number.isFinite(weightCapRaw) ? weightCapRaw : 5;

  return { priorityAgeMultiplier, priorityWeightCap };
}

function getAutomationPreset(keyRaw) {
  const key = String(keyRaw || "").trim().toUpperCase();
  return WORKFORCE_AUTOMATION_PRESETS[key] || null;
}

function normalizePresetPayload(input = {}) {
  const fallbackRoleRaw = String(input?.fallbackRole || "").toUpperCase();
  const fallbackRole =
    fallbackRoleRaw === "AUTO" || FALLBACK_ROLES.has(fallbackRoleRaw)
      ? fallbackRoleRaw
      : "AUTO";
  const escalationAfterMinutes = Number(input?.escalationAfterMinutes ?? 120);
  const priorityAgeMultiplier = Number(input?.conditions?.priorityAgeMultiplier ?? 1);
  const priorityWeightCap = Number(input?.conditions?.priorityWeightCap ?? 5);
  return {
    active: input?.active !== false,
    autoApprove: input?.autoApprove === true,
    requireSecondApprover: input?.requireSecondApprover !== false,
    fallbackRole,
    escalationAfterMinutes,
    conditions: {
      priorityAgeMultiplier,
      priorityWeightCap,
    },
  };
}

function validatePresetConfig(config = {}) {
  if (
    !Number.isFinite(config.escalationAfterMinutes) ||
    config.escalationAfterMinutes < 5 ||
    config.escalationAfterMinutes > 10080
  ) {
    return "escalationAfterMinutes must be between 5 and 10080";
  }
  if (
    !Number.isFinite(config.conditions?.priorityAgeMultiplier) ||
    config.conditions.priorityAgeMultiplier < 0.1 ||
    config.conditions.priorityAgeMultiplier > 10
  ) {
    return "priorityAgeMultiplier must be between 0.1 and 10";
  }
  if (
    !Number.isFinite(config.conditions?.priorityWeightCap) ||
    config.conditions.priorityWeightCap < 1 ||
    config.conditions.priorityWeightCap > 20
  ) {
    return "priorityWeightCap must be between 1 and 20";
  }
  return null;
}

async function getFallbackRoleLoadSnapshot({ hospitalId, candidates }) {
  const effectiveCandidates = candidates.length
    ? candidates
    : ["HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"];

  const users = await User.find({
    hospital: hospitalId,
    role: { $in: effectiveCandidates },
  })
    .select("_id role")
    .lean();

  if (!users.length) return [];

  const byRole = new Map();
  for (const role of effectiveCandidates) byRole.set(role, []);
  for (const u of users) {
    if (!byRole.has(u.role)) byRole.set(u.role, []);
    byRole.get(u.role).push(String(u._id));
  }

  const snapshot = [];
  for (const role of effectiveCandidates) {
    const ids = byRole.get(role) || [];
    if (!ids.length) continue;
    const pendingQuery = {
      hospital: hospitalId,
      user: { $in: ids },
      category: "WORKFORCE",
      read: false,
    };
    const [pendingAssignments, avgAgeAgg] = await Promise.all([
      Notification.countDocuments(pendingQuery),
      Notification.aggregate([
        { $match: pendingQuery },
        {
          $group: {
            _id: null,
            avgCreatedAt: { $avg: { $toLong: "$createdAt" } },
          },
        },
      ]),
    ]);
    const avgPendingAgeMinutes = avgAgeAgg[0]?.avgCreatedAt
      ? Math.max(0, Math.round((Date.now() - avgAgeAgg[0].avgCreatedAt) / 60000))
      : 0;
    snapshot.push({
      role,
      users: ids.length,
      pendingAssignments,
      avgPendingPerUser: pendingAssignments / ids.length,
      avgPendingAgeMinutes,
    });
  }
  return snapshot;
}

async function resolveFallbackRole({ policy, hospitalId }) {
  if (policy?.fallbackRole && policy.fallbackRole !== "AUTO" && FALLBACK_ROLES.has(policy.fallbackRole)) {
    return policy.fallbackRole;
  }

  const candidates = normalizeFallbackCandidates(policy?.conditions?.fallbackCandidates);
  const snapshot = await getFallbackRoleLoadSnapshot({ hospitalId, candidates });
  if (!snapshot.length) return "HOSPITAL_ADMIN";

  let best = null;
  for (const candidate of snapshot) {
    if (
      !best ||
      candidate.avgPendingPerUser < best.avgPendingPerUser ||
      (candidate.avgPendingPerUser === best.avgPendingPerUser && candidate.users > best.users)
    ) {
      best = candidate;
    }
  }

  return best?.role || "HOSPITAL_ADMIN";
}

function computeEscalationPriority({
  stageOneApprovedAt,
  escalationAfterMinutes,
  priorityAgeMultiplier = 1,
  priorityWeightCap = 5,
}) {
  const now = Date.now();
  const stageOneTs = new Date(stageOneApprovedAt).getTime();
  if (!Number.isFinite(stageOneTs)) return 1;
  const ageMinutes = Math.max(0, (now - stageOneTs) / 60000);
  const base = Math.max(1, Number(escalationAfterMinutes || 120));
  const multiplier = Math.max(0.1, Number(priorityAgeMultiplier || 1));
  const cap = Math.max(1, Number(priorityWeightCap || 5));
  const overdueFactor = (ageMinutes / base) * multiplier;
  return Number(Math.min(cap, 1 + overdueFactor).toFixed(3));
}

async function forecastFallbackDistribution({ policy, hospitalId, candidateRows }) {
  const candidates = normalizeFallbackCandidates(policy?.conditions?.fallbackCandidates);
  const snapshot = await getFallbackRoleLoadSnapshot({ hospitalId, candidates });
  if (!snapshot.length) {
    return {
      mode: "FIXED",
      selectedRole: "HOSPITAL_ADMIN",
      roles: [],
    };
  }

  const fallbackRoleRaw = String(policy?.fallbackRole || "").toUpperCase();
  const isAuto = fallbackRoleRaw === "AUTO" || !fallbackRoleRaw;
  const selectedRole = await resolveFallbackRole({ policy, hospitalId });
  const rows = Array.isArray(candidateRows) ? candidateRows : [];
  const tuning = normalizePriorityTuning(policy?.conditions || {});

  const projected = snapshot.map((row) => ({
    ...row,
    projectedAssignments: 0,
    projectedWeightedAssignments: 0,
  }));
  const byRole = new Map(projected.map((row) => [row.role, row]));

  const weightedDemand = rows.reduce(
    (sum, row) =>
      sum +
      computeEscalationPriority({
        stageOneApprovedAt: row.stageOneApprovedAt,
        escalationAfterMinutes: policy?.escalationAfterMinutes,
        priorityAgeMultiplier: tuning.priorityAgeMultiplier,
        priorityWeightCap: tuning.priorityWeightCap,
      }),
    0
  );

  if (!isAuto && byRole.has(selectedRole)) {
    byRole.get(selectedRole).projectedAssignments = rows.length;
    byRole.get(selectedRole).projectedWeightedAssignments = Number(weightedDemand.toFixed(3));
  } else {
    const sortedRows = [...rows].sort(
      (a, b) =>
        new Date(a.stageOneApprovedAt).getTime() - new Date(b.stageOneApprovedAt).getTime()
    );
    for (const requestRow of sortedRows) {
      const requestWeight = computeEscalationPriority({
        stageOneApprovedAt: requestRow.stageOneApprovedAt,
        escalationAfterMinutes: policy?.escalationAfterMinutes,
        priorityAgeMultiplier: tuning.priorityAgeMultiplier,
        priorityWeightCap: tuning.priorityWeightCap,
      });
      let pick = null;
      for (const row of projected) {
        const effectiveWeightedLoad =
          (row.pendingAssignments + row.projectedAssignments) / row.users +
          (row.avgPendingAgeMinutes / 180) +
          (row.projectedWeightedAssignments / row.users / 2);
        const currentProjectedAvg =
          Number(effectiveWeightedLoad.toFixed(4));
        if (
          !pick ||
          currentProjectedAvg < pick.currentProjectedAvg ||
          (currentProjectedAvg === pick.currentProjectedAvg && row.users > pick.users)
        ) {
          pick = { role: row.role, currentProjectedAvg, users: row.users };
        }
      }
      if (pick && byRole.has(pick.role)) {
        byRole.get(pick.role).projectedAssignments += 1;
        byRole.get(pick.role).projectedWeightedAssignments = Number(
          (byRole.get(pick.role).projectedWeightedAssignments + requestWeight).toFixed(3)
        );
      }
    }
  }

  return {
    mode: isAuto ? "AUTO" : "FIXED",
    selectedRole,
    tuning,
    roles: projected.map((row) => ({
      role: row.role,
      users: row.users,
      currentPendingAssignments: row.pendingAssignments,
      currentAvgPendingAgeMinutes: row.avgPendingAgeMinutes,
      avgPendingPerUser: Number(row.avgPendingPerUser.toFixed(3)),
      projectedAssignments: row.projectedAssignments,
      projectedWeightedAssignments: Number(row.projectedWeightedAssignments.toFixed(3)),
      projectedAvgPendingPerUser: Number(
        ((row.pendingAssignments + row.projectedAssignments) / row.users).toFixed(3)
      ),
      projectedPriorityPressure: Number(
        ((row.projectedWeightedAssignments || 0) / Math.max(1, row.users)).toFixed(3)
      ),
    })),
    weightedDemand: Number(weightedDemand.toFixed(3)),
  };
}

async function notifyUsersByRole({ hospitalId, role, title, body, meta, category }) {
  if (!hospitalId || !role) return;
  const users = await User.find({ hospital: hospitalId, role })
    .select("_id")
    .lean();
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({
      title,
      body,
      user: u._id,
      hospital: hospitalId,
      meta,
      category: category || "SYSTEM",
    }))
  );
}

function toDays(startDate, endDate) {
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.ceil((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function policyMatches(requestType, policy, payload = {}) {
  if (!policy?.active || !policy?.autoApprove) return false;
  const conditions = policy.conditions || {};
  if (requestType === "LEAVE") {
    const max = Number(conditions.maxLeaveDays || 0);
    if (max <= 0) return false;
    const days = toDays(payload.startDate, payload.endDate);
    return days > 0 && days <= max;
  }
  if (requestType === "OVERTIME") {
    const max = Number(conditions.maxOvertimeHours || 0);
    if (max <= 0) return false;
    const hours = Number(payload.hours || 0);
    return Number.isFinite(hours) && hours > 0 && hours <= max;
  }
  if (requestType === "SHIFT") {
    const allowed = Array.isArray(conditions.allowedShiftTypes)
      ? conditions.allowedShiftTypes.map((v) => String(v).toUpperCase())
      : [];
    if (!allowed.length) return false;
    return allowed.includes(String(payload.shiftType || "").toUpperCase());
  }
  return false;
}

async function applyAutoApproval({ item, requestType, policy, actorId }) {
  if (!policyMatches(requestType, policy, item)) return false;
  item.status = "APPROVED";
  item.approvalStage = "APPROVED_FINAL";
  item.approvedBy = actorId;
  item.stageOneApprovedBy = actorId;
  item.stageOneApprovedAt = new Date();
  item.stageTwoApprovedBy = actorId;
  item.stageTwoApprovedAt = new Date();
  item.approvedAt = new Date();
  await item.save();
  return true;
}

async function maybeStageOneApproval({ item, requestType, req, hospitalId }) {
  const policy = await getAutomationPolicy(hospitalId, requestType);
  if (!policy?.active || !policy.requireSecondApprover) return { handled: false };
  if (item.status !== "PENDING") return { handled: false };
  if (item.approvalStage === "L2_PENDING") return { handled: false };

  item.approvalStage = "L2_PENDING";
  item.stageOneApprovedBy = req.user._id;
  item.stageOneApprovedAt = new Date();
  item.fallbackRole = await resolveFallbackRole({ policy, hospitalId });
  await item.save();

  await notifyUsersByRole({
    hospitalId,
    role: item.fallbackRole,
    title: "Second-Level Approval Required",
    body: `${requestType} request requires secondary approval.`,
    meta: { type: requestType, requestId: item._id, stage: "L2_PENDING" },
    category: "WORKFORCE",
  });
  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_REQUEST_STAGE1_APPROVED",
    resource: `${requestType.toLowerCase()}_request`,
    resourceId: item._id,
    hospital: hospitalId,
    after: { requestType, approvalStage: "L2_PENDING", fallbackRole: item.fallbackRole },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });
  return { handled: true, item };
}

/* =========================
   LEAVE REQUESTS
========================= */
export const listLeaveRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: LeaveRequest,
    filter,
    populate: { path: "requester", select: "name email role" },
  });
};

export const listMyLeaveRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId, requester: req.user._id };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: LeaveRequest,
    filter,
  });
};

export const createLeaveRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const { type, reason, startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "startDate and endDate required" });
  }

  const now = new Date();
  const { slaDueAt } = await computeSlaDates(hospitalId, "LEAVE", now);
  const automationPolicy = await getAutomationPolicy(hospitalId, "LEAVE");

  const item = await LeaveRequest.create({
    hospital: hospitalId,
    requester: req.user._id,
    type,
    reason,
    startDate,
    endDate,
    slaDueAt,
  });
  const autoApproved = await applyAutoApproval({
    item,
    requestType: "LEAVE",
    policy: automationPolicy,
    actorId: req.user._id,
  });

  try {
    if (autoApproved) {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Leave Request Auto-Approved",
        body: `${req.user?.name || "Staff"} leave request was auto-approved by policy.`,
        meta: { type: "LEAVE", requestId: item._id, automated: true },
        category: "WORKFORCE",
      });
      await logAudit({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "WORKFORCE_REQUEST_AUTO_APPROVED",
        resource: "leave_request",
        resourceId: item._id,
        hospital: hospitalId,
        after: { requestType: "LEAVE" },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    } else {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Leave Request Submitted",
        body: `${req.user?.name || "Staff"} submitted a leave request.`,
        meta: { type: "LEAVE", requestId: item._id },
        category: "WORKFORCE",
      });
    }
  } catch (err) {
    console.warn("Leave notification failed:", err.message);
  }

  res.status(201).json(item);
};

export const approveLeaveRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;

  const item = await LeaveRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  if (item.approvalStage === "L2_PENDING" && String(item.stageOneApprovedBy || "") === String(req.user._id)) {
    return res.status(403).json({ message: "Second-level approver must be different" });
  }
  const staged = await maybeStageOneApproval({
    item,
    requestType: "LEAVE",
    req,
    hospitalId,
  });
  if (staged.handled) {
    return res.json({ ...staged.item.toObject(), workflow: "L2_PENDING" });
  }

  item.status = "APPROVED";
  item.approvalStage = "APPROVED_FINAL";
  item.approvedBy = req.user._id;
  if (!item.stageOneApprovedBy) {
    item.stageOneApprovedBy = req.user._id;
    item.stageOneApprovedAt = new Date();
  }
  item.stageTwoApprovedBy = req.user._id;
  item.stageTwoApprovedAt = new Date();
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

export const rejectLeaveRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;
  const { reason } = req.body || {};

  const item = await LeaveRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  item.status = "REJECTED";
  item.approvalStage = "REJECTED_FINAL";
  item.rejectionReason = reason || "Rejected";
  item.approvedBy = req.user._id;
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

/* =========================
   OVERTIME REQUESTS
========================= */
export const listOvertimeRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: OvertimeRequest,
    filter,
    populate: { path: "requester", select: "name email role" },
  });
};

export const listMyOvertimeRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId, requester: req.user._id };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: OvertimeRequest,
    filter,
  });
};

export const createOvertimeRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const { hours, date, reason } = req.body;

  if (!hours || !date) {
    return res.status(400).json({ message: "hours and date required" });
  }

  const now = new Date();
  const { slaDueAt } = await computeSlaDates(hospitalId, "OVERTIME", now);
  const automationPolicy = await getAutomationPolicy(hospitalId, "OVERTIME");

  const item = await OvertimeRequest.create({
    hospital: hospitalId,
    requester: req.user._id,
    hours,
    date,
    reason,
    slaDueAt,
  });
  const autoApproved = await applyAutoApproval({
    item,
    requestType: "OVERTIME",
    policy: automationPolicy,
    actorId: req.user._id,
  });

  try {
    if (autoApproved) {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Overtime Request Auto-Approved",
        body: `${req.user?.name || "Staff"} overtime request was auto-approved by policy.`,
        meta: { type: "OVERTIME", requestId: item._id, automated: true },
        category: "WORKFORCE",
      });
      await logAudit({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "WORKFORCE_REQUEST_AUTO_APPROVED",
        resource: "overtime_request",
        resourceId: item._id,
        hospital: hospitalId,
        after: { requestType: "OVERTIME" },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    } else {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Overtime Request Submitted",
        body: `${req.user?.name || "Staff"} submitted an overtime request.`,
        meta: { type: "OVERTIME", requestId: item._id },
        category: "WORKFORCE",
      });
    }
  } catch (err) {
    console.warn("Overtime notification failed:", err.message);
  }

  res.status(201).json(item);
};

export const approveOvertimeRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;

  const item = await OvertimeRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  if (item.approvalStage === "L2_PENDING" && String(item.stageOneApprovedBy || "") === String(req.user._id)) {
    return res.status(403).json({ message: "Second-level approver must be different" });
  }
  const staged = await maybeStageOneApproval({
    item,
    requestType: "OVERTIME",
    req,
    hospitalId,
  });
  if (staged.handled) {
    return res.json({ ...staged.item.toObject(), workflow: "L2_PENDING" });
  }

  item.status = "APPROVED";
  item.approvalStage = "APPROVED_FINAL";
  item.approvedBy = req.user._id;
  if (!item.stageOneApprovedBy) {
    item.stageOneApprovedBy = req.user._id;
    item.stageOneApprovedAt = new Date();
  }
  item.stageTwoApprovedBy = req.user._id;
  item.stageTwoApprovedAt = new Date();
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

export const rejectOvertimeRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;
  const { reason } = req.body || {};

  const item = await OvertimeRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  item.status = "REJECTED";
  item.approvalStage = "REJECTED_FINAL";
  item.rejectionReason = reason || "Rejected";
  item.approvedBy = req.user._id;
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

/* =========================
   SHIFT REQUESTS
========================= */
export const listShiftRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: ShiftRequest,
    filter,
    populate: { path: "requester", select: "name email role" },
  });
};

export const listPendingRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }

  const kind = normalizeRequestType(req.query.kind);
  const modelByKind = {
    LEAVE: LeaveRequest,
    OVERTIME: OvertimeRequest,
    SHIFT: ShiftRequest,
  };
  const model = modelByKind[kind];
  if (!model) {
    return res
      .status(400)
      .json({ message: "kind must be one of LEAVE, OVERTIME, SHIFT" });
  }

  const status = req.query.status || "PENDING";
  const { page, limit, cursor, wantsPaged, cursorMode } = parseListArgs(req);
  const baseFilter = { hospital: hospitalId, status };

  if (!wantsPaged) {
    const rows = await model
      .find(baseFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(500)
      .populate({ path: "requester", select: "name email role" });
    return res.json(rows.map((row) => ({ ...row.toObject(), kind })));
  }

  if (cursorMode) {
    let cursorFilter = { ...baseFilter };
    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      cursorFilter = {
        ...baseFilter,
        $or: [
          { createdAt: { $lt: new Date(parsed.createdAt) } },
          { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
        ],
      };
    }
    const rows = await model
      .find(cursorFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate({ path: "requester", select: "name email role" });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
    return res.json({
      items: items.map((row) => ({ ...row.toObject(), kind })),
      nextCursor,
      hasMore,
      limit,
      kind,
    });
  }

  const [rows, total] = await Promise.all([
    model
      .find(baseFilter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "requester", select: "name email role" }),
    model.countDocuments(baseFilter),
  ]);
  return res.json({
    items: rows.map((row) => ({ ...row.toObject(), kind })),
    total,
    page,
    limit,
    kind,
  });
};

export const listMyShiftRequests = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const status = req.query.status;
  const filter = { hospital: hospitalId, requester: req.user._id };
  if (status) filter.status = status;

  return listRequests({
    req,
    res,
    model: ShiftRequest,
    filter,
  });
};

export const createShiftRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(400).json({ message: "Hospital not assigned" });
  }
  const { shiftType, date, reason } = req.body;

  if (!date) {
    return res.status(400).json({ message: "date required" });
  }

  const now = new Date();
  const { slaDueAt } = await computeSlaDates(hospitalId, "SHIFT", now);
  const automationPolicy = await getAutomationPolicy(hospitalId, "SHIFT");

  const item = await ShiftRequest.create({
    hospital: hospitalId,
    requester: req.user._id,
    shiftType,
    date,
    reason,
    slaDueAt,
  });
  const autoApproved = await applyAutoApproval({
    item,
    requestType: "SHIFT",
    policy: automationPolicy,
    actorId: req.user._id,
  });

  try {
    if (autoApproved) {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Shift Request Auto-Approved",
        body: `${req.user?.name || "Staff"} shift request was auto-approved by policy.`,
        meta: { type: "SHIFT", requestId: item._id, automated: true },
        category: "WORKFORCE",
      });
      await logAudit({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "WORKFORCE_REQUEST_AUTO_APPROVED",
        resource: "shift_request",
        resourceId: item._id,
        hospital: hospitalId,
        after: { requestType: "SHIFT" },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    } else {
      await notifyHospitalAdmins({
        hospitalId,
        title: "Shift Request Submitted",
        body: `${req.user?.name || "Staff"} submitted a shift request.`,
        meta: { type: "SHIFT", requestId: item._id },
        category: "WORKFORCE",
      });
    }
  } catch (err) {
    console.warn("Shift notification failed:", err.message);
  }

  res.status(201).json(item);
};

export const approveShiftRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;

  const item = await ShiftRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  if (item.approvalStage === "L2_PENDING" && String(item.stageOneApprovedBy || "") === String(req.user._id)) {
    return res.status(403).json({ message: "Second-level approver must be different" });
  }
  const staged = await maybeStageOneApproval({
    item,
    requestType: "SHIFT",
    req,
    hospitalId,
  });
  if (staged.handled) {
    return res.json({ ...staged.item.toObject(), workflow: "L2_PENDING" });
  }

  item.status = "APPROVED";
  item.approvalStage = "APPROVED_FINAL";
  item.approvedBy = req.user._id;
  if (!item.stageOneApprovedBy) {
    item.stageOneApprovedBy = req.user._id;
    item.stageOneApprovedAt = new Date();
  }
  item.stageTwoApprovedBy = req.user._id;
  item.stageTwoApprovedAt = new Date();
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

export const rejectShiftRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const { id } = req.params;
  const { reason } = req.body || {};

  const item = await ShiftRequest.findOne({ _id: id, hospital: hospitalId });
  if (!item) return res.status(404).json({ message: "Not found" });

  item.status = "REJECTED";
  item.approvalStage = "REJECTED_FINAL";
  item.rejectionReason = reason || "Rejected";
  item.approvedBy = req.user._id;
  item.approvedAt = new Date();
  await item.save();

  res.json(item);
};

export const getWorkforceSlaPolicies = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const existing = await WorkflowSlaPolicy.find({ hospital: hospitalId })
    .lean()
    .select("requestType targetMinutes escalationMinutes active updatedAt");

  const byType = new Map(existing.map((row) => [row.requestType, row]));
  const policies = WORKFORCE_REQUEST_TYPES.map((type) => {
    const found = byType.get(type);
    if (found) return found;
    const fallback = WORKFORCE_SLA_DEFAULTS[type];
    return {
      requestType: type,
      targetMinutes: fallback.targetMinutes,
      escalationMinutes: fallback.escalationMinutes,
      active: fallback.active,
      source: "default",
    };
  });

  return res.json({ items: policies });
};

export const upsertWorkforceSlaPolicy = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const requestType = normalizeRequestType(req.params.requestType);
  if (!WORKFORCE_REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({ message: "Invalid request type" });
  }

  const targetMinutes = Number(req.body?.targetMinutes);
  const escalationMinutes = Number(req.body?.escalationMinutes);
  const active = req.body?.active !== false;

  if (!Number.isFinite(targetMinutes) || targetMinutes < 1 || targetMinutes > 43200) {
    return res.status(400).json({ message: "targetMinutes must be between 1 and 43200" });
  }
  if (
    !Number.isFinite(escalationMinutes) ||
    escalationMinutes < targetMinutes ||
    escalationMinutes > 43200
  ) {
    return res
      .status(400)
      .json({ message: "escalationMinutes must be >= targetMinutes and <= 43200" });
  }

  const policy = await WorkflowSlaPolicy.findOneAndUpdate(
    { hospital: hospitalId, requestType },
    { targetMinutes, escalationMinutes, active },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_SLA_POLICY_UPDATED",
    resource: "workflow_sla_policy",
    resourceId: policy._id,
    hospital: hospitalId,
    after: {
      requestType,
      targetMinutes,
      escalationMinutes,
      active,
    },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json(policy);
};

async function queueStatsForModel(model, hospitalId) {
  const now = new Date();
  const pendingFilter = { hospital: hospitalId, status: "PENDING" };
  const [pending, approved, rejected, breached, l2Pending, oldestPending] = await Promise.all([
    model.countDocuments(pendingFilter),
    model.countDocuments({ hospital: hospitalId, status: "APPROVED" }),
    model.countDocuments({ hospital: hospitalId, status: "REJECTED" }),
    model.countDocuments({
      ...pendingFilter,
      $or: [{ slaBreachedAt: { $ne: null } }, { slaDueAt: { $lte: now } }],
    }),
    model.countDocuments({ ...pendingFilter, approvalStage: "L2_PENDING" }),
    model.findOne(pendingFilter).sort({ createdAt: 1 }).select("createdAt"),
  ]);

  let avgPendingAgeMinutes = 0;
  if (pending > 0) {
    const agg = await model.aggregate([
      { $match: pendingFilter },
      {
        $group: {
          _id: null,
          avgCreatedAt: { $avg: { $toLong: "$createdAt" } },
        },
      },
    ]);
    if (agg[0]?.avgCreatedAt) {
      avgPendingAgeMinutes = Math.max(0, Math.round((Date.now() - agg[0].avgCreatedAt) / 60000));
    }
  }

  return {
    pending,
    l2Pending,
    approved,
    rejected,
    breached,
    avgPendingAgeMinutes,
    oldestPendingAt: oldestPending?.createdAt || null,
  };
}

export const getWorkforceQueueInsights = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const [leave, overtime, shift] = await Promise.all([
    queueStatsForModel(LeaveRequest, hospitalId),
    queueStatsForModel(OvertimeRequest, hospitalId),
    queueStatsForModel(ShiftRequest, hospitalId),
  ]);

  return res.json({
    generatedAt: new Date(),
    totals: {
      pending: leave.pending + overtime.pending + shift.pending,
      l2Pending: leave.l2Pending + overtime.l2Pending + shift.l2Pending,
      approved: leave.approved + overtime.approved + shift.approved,
      rejected: leave.rejected + overtime.rejected + shift.rejected,
      breached: leave.breached + overtime.breached + shift.breached,
    },
    queues: { leave, overtime, shift },
  });
};

export const getWorkforceAutomationPolicies = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const existing = await WorkflowAutomationPolicy.find({ hospital: hospitalId })
    .lean()
    .select(
      "requestType active autoApprove requireSecondApprover fallbackRole escalationAfterMinutes conditions updatedAt"
    );

  const byType = new Map(existing.map((row) => [row.requestType, row]));
  const items = WORKFORCE_REQUEST_TYPES.map((type) => {
    const found = byType.get(type);
    if (found) return found;
    return { ...WORKFORCE_AUTOMATION_DEFAULTS[type], source: "default" };
  });
  return res.json({ items });
};

export const getWorkforceAutomationPresets = async (_req, res) => {
  const hospitalId = getHospitalId(_req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });
  const includeInactive =
    _req.query?.includeInactive === "1" || _req.query?.includeInactive === "true";
  const custom = await WorkflowAutomationPreset.find({
    hospital: hospitalId,
    ...(includeInactive ? {} : { active: true }),
  })
    .lean()
    .select("key name description version config updatedAt active");

  const builtin = Object.values(WORKFORCE_AUTOMATION_PRESETS).map((row) => ({
    ...row,
    source: "SYSTEM",
    version: 1,
    updatedAt: null,
  }));
  const customMapped = custom.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    version: row.version || 1,
    config: row.config,
    source: "CUSTOM",
    updatedAt: row.updatedAt || null,
    active: row.active !== false,
  }));

  return res.json({ items: [...builtin, ...customMapped] });
};

export const upsertWorkforceAutomationPreset = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const key = String(req.body?.key || "")
    .trim()
    .toUpperCase();
  if (!key || key.length < 3 || key.length > 32 || !/^[A-Z0-9_]+$/.test(key)) {
    return res
      .status(400)
      .json({ message: "Preset key must be 3-32 chars using A-Z, 0-9, underscore" });
  }
  if (WORKFORCE_AUTOMATION_PRESETS[key]) {
    return res.status(400).json({ message: "Preset key is reserved by system" });
  }

  const name = String(req.body?.name || "").trim();
  if (!name || name.length < 3 || name.length > 64) {
    return res.status(400).json({ message: "Preset name must be between 3 and 64 characters" });
  }
  const description = String(req.body?.description || "").trim();
  const config = normalizePresetPayload(req.body?.config || {});
  const configValidation = validatePresetConfig(config);
  if (configValidation) return res.status(400).json({ message: configValidation });

  const existing = await WorkflowAutomationPreset.findOne({ hospital: hospitalId, key });
  const row = await WorkflowAutomationPreset.findOneAndUpdate(
    { hospital: hospitalId, key },
    {
      name,
      description,
      config,
      active: true,
      updatedBy: req.user?._id || null,
      version: existing ? Number(existing.version || 1) + 1 : 1,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_AUTOMATION_PRESET_UPSERTED",
    resource: "workflow_automation_preset",
    resourceId: row._id,
    hospital: hospitalId,
    after: { key, version: row.version },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json(row);
};

export const deactivateWorkforceAutomationPreset = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const key = String(req.params?.key || "")
    .trim()
    .toUpperCase();
  if (!key) return res.status(400).json({ message: "Preset key is required" });
  if (WORKFORCE_AUTOMATION_PRESETS[key]) {
    return res.status(400).json({ message: "System presets cannot be deactivated" });
  }

  const row = await WorkflowAutomationPreset.findOneAndUpdate(
    { hospital: hospitalId, key, active: true },
    { active: false, updatedBy: req.user?._id || null },
    { new: true }
  );
  if (!row) return res.status(404).json({ message: "Custom preset not found" });

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_AUTOMATION_PRESET_DEACTIVATED",
    resource: "workflow_automation_preset",
    resourceId: row._id,
    hospital: hospitalId,
    after: { key, active: false },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json({ ok: true, key });
};

export const reactivateWorkforceAutomationPreset = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const key = String(req.params?.key || "")
    .trim()
    .toUpperCase();
  if (!key) return res.status(400).json({ message: "Preset key is required" });
  if (WORKFORCE_AUTOMATION_PRESETS[key]) {
    return res.status(400).json({ message: "System presets do not require reactivation" });
  }

  const existing = await WorkflowAutomationPreset.findOne({ hospital: hospitalId, key });
  if (!existing) return res.status(404).json({ message: "Custom preset not found" });
  if (existing.active) return res.json({ ok: true, key, active: true });

  existing.active = true;
  existing.updatedBy = req.user?._id || null;
  existing.version = Number(existing.version || 1) + 1;
  await existing.save();

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_AUTOMATION_PRESET_REACTIVATED",
    resource: "workflow_automation_preset",
    resourceId: existing._id,
    hospital: hospitalId,
    after: { key, active: true, version: existing.version },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json({ ok: true, key, active: true, version: existing.version });
};

export const getWorkforceAutomationPresetHistory = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
  const rows = await AuditLog.find({
    hospital: hospitalId,
    action: {
      $in: [
        "WORKFORCE_AUTOMATION_PRESET_UPSERTED",
        "WORKFORCE_AUTOMATION_PRESET_DEACTIVATED",
        "WORKFORCE_AUTOMATION_PRESET_REACTIVATED",
        "WORKFORCE_AUTOMATION_PRESET_APPLIED_ALL",
      ],
    },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: "actorId", select: "name email role" })
    .select("action actorId actorRole after createdAt success");

  const items = rows.map((row) => ({
    id: row._id,
    action: row.action,
    actor: row.actorId
      ? {
          id: row.actorId._id,
          name: row.actorId.name || null,
          email: row.actorId.email || null,
          role: row.actorId.role || row.actorRole || null,
        }
      : { id: null, name: null, email: null, role: row.actorRole || null },
    presetKey: row.after?.key || row.after?.presetKey || null,
    requestTypes: Array.isArray(row.after?.requestTypes) ? row.after.requestTypes : [],
    createdAt: row.createdAt,
    success: row.success !== false,
  }));

  return res.json({ items, limit });
};

export const applyWorkforceAutomationPresetAll = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const preset = getAutomationPreset(req.body?.presetKey);
  let effectivePreset = preset;
  if (!effectivePreset) {
    const custom = await WorkflowAutomationPreset.findOne({
      hospital: hospitalId,
      key: String(req.body?.presetKey || "").toUpperCase(),
      active: true,
    })
      .lean()
      .select("key name config");
    if (custom) {
      effectivePreset = {
        key: custom.key,
        name: custom.name,
        config: custom.config,
      };
    }
  }
  if (!effectivePreset) return res.status(400).json({ message: "Invalid preset key" });

  const existingRows = await WorkflowAutomationPolicy.find({
    hospital: hospitalId,
    requestType: { $in: WORKFORCE_REQUEST_TYPES },
  })
    .lean()
    .select("requestType conditions");
  const existingByType = new Map(existingRows.map((row) => [row.requestType, row]));

  const updatedRows = await Promise.all(
    WORKFORCE_REQUEST_TYPES.map(async (requestType) => {
      const baseDefault = WORKFORCE_AUTOMATION_DEFAULTS[requestType] || {};
      const existing = existingByType.get(requestType);
      const mergedConditions = {
        ...(baseDefault.conditions || {}),
        ...(existing?.conditions || {}),
        ...(effectivePreset.config.conditions || {}),
      };
      return WorkflowAutomationPolicy.findOneAndUpdate(
        { hospital: hospitalId, requestType },
        {
          active: effectivePreset.config.active !== false,
          autoApprove: effectivePreset.config.autoApprove === true,
          requireSecondApprover: effectivePreset.config.requireSecondApprover === true,
          fallbackRole: String(effectivePreset.config.fallbackRole || "AUTO").toUpperCase(),
          escalationAfterMinutes: Number(effectivePreset.config.escalationAfterMinutes || 120),
          conditions: mergedConditions,
          updatedBy: req.user?._id || null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    })
  );

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_AUTOMATION_PRESET_APPLIED_ALL",
    resource: "workflow_automation_policy",
    hospital: hospitalId,
    after: {
      presetKey: effectivePreset.key,
      requestTypes: WORKFORCE_REQUEST_TYPES,
    },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json({
    appliedPreset: effectivePreset.key,
    count: updatedRows.length,
    items: updatedRows,
  });
};

export const upsertWorkforceAutomationPolicy = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });
  const requestType = normalizeRequestType(req.params.requestType);
  if (!WORKFORCE_REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({ message: "Invalid request type" });
  }

  const active = req.body?.active !== false;
  const autoApprove = req.body?.autoApprove === true;
  const requireSecondApprover = req.body?.requireSecondApprover === true;
  const fallbackRoleRaw = String(req.body?.fallbackRole || "").toUpperCase();
  const fallbackRole =
    fallbackRoleRaw === "AUTO" || FALLBACK_ROLES.has(fallbackRoleRaw)
      ? fallbackRoleRaw
      : "";
  const escalationAfterMinutes = Number(req.body?.escalationAfterMinutes || 120);
  const conditions = {
    maxLeaveDays: Number(req.body?.conditions?.maxLeaveDays || 0),
    maxOvertimeHours: Number(req.body?.conditions?.maxOvertimeHours || 0),
    priorityAgeMultiplier: Number(req.body?.conditions?.priorityAgeMultiplier ?? 1),
    priorityWeightCap: Number(req.body?.conditions?.priorityWeightCap ?? 5),
    allowedShiftTypes: Array.isArray(req.body?.conditions?.allowedShiftTypes)
      ? req.body.conditions.allowedShiftTypes.map((v) => String(v).toUpperCase())
      : [],
    fallbackCandidates: normalizeFallbackCandidates(req.body?.conditions?.fallbackCandidates),
  };

  if (conditions.maxLeaveDays < 0 || conditions.maxLeaveDays > 60) {
    return res.status(400).json({ message: "maxLeaveDays must be between 0 and 60" });
  }
  if (conditions.maxOvertimeHours < 0 || conditions.maxOvertimeHours > 24) {
    return res.status(400).json({ message: "maxOvertimeHours must be between 0 and 24" });
  }
  if (
    !Number.isFinite(conditions.priorityAgeMultiplier) ||
    conditions.priorityAgeMultiplier < 0.1 ||
    conditions.priorityAgeMultiplier > 10
  ) {
    return res
      .status(400)
      .json({ message: "priorityAgeMultiplier must be between 0.1 and 10" });
  }
  if (
    !Number.isFinite(conditions.priorityWeightCap) ||
    conditions.priorityWeightCap < 1 ||
    conditions.priorityWeightCap > 20
  ) {
    return res
      .status(400)
      .json({ message: "priorityWeightCap must be between 1 and 20" });
  }
  if (!Number.isFinite(escalationAfterMinutes) || escalationAfterMinutes < 5 || escalationAfterMinutes > 10080) {
    return res.status(400).json({ message: "escalationAfterMinutes must be between 5 and 10080" });
  }

  const row = await WorkflowAutomationPolicy.findOneAndUpdate(
    { hospital: hospitalId, requestType },
    {
      active,
      autoApprove,
      requireSecondApprover,
      fallbackRole,
      escalationAfterMinutes,
      conditions,
      updatedBy: req.user?._id || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action: "WORKFORCE_AUTOMATION_POLICY_UPDATED",
    resource: "workflow_automation_policy",
    resourceId: row._id,
    hospital: hospitalId,
    after: {
      requestType,
      active,
      autoApprove,
      requireSecondApprover,
      fallbackRole,
      escalationAfterMinutes,
      conditions,
    },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.json(row);
};

export const simulateWorkforceAutomation = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });
  const requestType = normalizeRequestType(req.body?.requestType);
  if (!WORKFORCE_REQUEST_TYPES.includes(requestType)) {
    return res.status(400).json({ message: "Invalid request type" });
  }
  const policy = await getAutomationPolicy(hospitalId, requestType);
  const sample = req.body?.sample || {};
  const autoApprove = policyMatches(requestType, policy, sample);
  return res.json({
    requestType,
    policy,
    decision: {
      autoApprove,
      requiresSecondApprover: Boolean(policy?.requireSecondApprover),
      fallbackRole: await resolveFallbackRole({ policy, hospitalId }),
    },
  });
};

async function runFallbackForType({ model, requestType, hospitalId, actor, ip, userAgent }) {
  const policy = await getAutomationPolicy(hospitalId, requestType);
  if (!policy?.active || !policy.requireSecondApprover) return 0;
  const fallbackRole = await resolveFallbackRole({ policy, hospitalId });
  const cutoff = new Date(Date.now() - Number(policy.escalationAfterMinutes || 120) * 60 * 1000);
  const rows = await model.find({
    hospital: hospitalId,
    status: "PENDING",
    approvalStage: "L2_PENDING",
    stageOneApprovedAt: { $lte: cutoff },
    $or: [{ escalatedAt: null }, { escalatedAt: { $exists: false } }],
  })
    .sort({ stageOneApprovedAt: 1 })
    .limit(200);
  if (!rows.length) return 0;

  await notifyUsersByRole({
    hospitalId,
    role: fallbackRole,
    title: "Approval Escalation Required",
    body: `${rows.length} ${requestType} requests exceeded L2 approval SLA.`,
    meta: { type: requestType, escalated: true, count: rows.length },
    category: "WORKFORCE",
  });

  const now = new Date();
  await model.updateMany(
    { _id: { $in: rows.map((r) => r._id) } },
    { $set: { escalatedAt: now, fallbackRole }, $inc: { escalationLevel: 1 } }
  );
  await logAudit({
    actorId: actor?._id,
    actorRole: actor?.role,
    action: "WORKFORCE_L2_ESCALATION_DISPATCHED",
    resource: `${requestType.toLowerCase()}_request`,
    hospital: hospitalId,
    after: { requestType, count: rows.length, fallbackRole },
    ip,
    userAgent,
  });
  return rows.length;
}

async function previewFallbackForType({ model, requestType, hospitalId, limit = 50 }) {
  const policy = await getAutomationPolicy(hospitalId, requestType);
  if (!policy?.active || !policy.requireSecondApprover) {
    return {
      requestType,
      eligible: false,
      reason: "SECOND_APPROVER_NOT_ENABLED",
      fallbackRole: null,
      totalCandidates: 0,
      oldestStageOneApprovedAt: null,
      sampleRequestIds: [],
    };
  }

  const fallbackRole = await resolveFallbackRole({ policy, hospitalId });
  const cutoff = new Date(Date.now() - Number(policy.escalationAfterMinutes || 120) * 60 * 1000);
  const rows = await model.find({
    hospital: hospitalId,
    status: "PENDING",
    approvalStage: "L2_PENDING",
    stageOneApprovedAt: { $lte: cutoff },
    $or: [{ escalatedAt: null }, { escalatedAt: { $exists: false } }],
  })
    .sort({ stageOneApprovedAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
    .select("_id stageOneApprovedAt")
    .lean();

  const forecast = await forecastFallbackDistribution({
    policy,
    hospitalId,
    candidateRows: rows,
  });

  return {
    requestType,
    eligible: true,
    fallbackRole,
    fallbackMode: forecast.mode,
    escalationAfterMinutes: Number(policy.escalationAfterMinutes || 120),
    totalCandidates: rows.length,
    weightedCandidates: forecast.weightedDemand,
    oldestStageOneApprovedAt: rows[0]?.stageOneApprovedAt || null,
    sampleRequestIds: rows.slice(0, 10).map((r) => r._id),
    roleForecast: forecast.roles,
    priorityTuning: forecast.tuning,
  };
}

export const previewWorkforceEscalation = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });

  const onlyType = normalizeRequestType(req.query?.requestType);
  const requestedTypes = WORKFORCE_REQUEST_TYPES.includes(onlyType)
    ? [onlyType]
    : WORKFORCE_REQUEST_TYPES;
  const limit = Number(req.query?.limit || 50);

  const modelByType = {
    LEAVE: LeaveRequest,
    OVERTIME: OvertimeRequest,
    SHIFT: ShiftRequest,
  };

  const previews = await Promise.all(
    requestedTypes.map((requestType) =>
      previewFallbackForType({
        model: modelByType[requestType],
        requestType,
        hospitalId,
        limit,
      })
    )
  );

  const totals = previews.reduce(
    (acc, row) => {
      if (row.eligible) {
        acc.totalCandidates += row.totalCandidates;
      } else {
        acc.ineligible += 1;
      }
      return acc;
    },
    { totalCandidates: 0, ineligible: 0 }
  );

  return res.json({
    generatedAt: new Date(),
    requestTypes: requestedTypes,
    totals,
    previews,
  });
};

export const runWorkforceAutomationSweep = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital not assigned" });
  const [leave, overtime, shift] = await Promise.all([
    runFallbackForType({
      model: LeaveRequest,
      requestType: "LEAVE",
      hospitalId,
      actor: req.user,
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    }),
    runFallbackForType({
      model: OvertimeRequest,
      requestType: "OVERTIME",
      hospitalId,
      actor: req.user,
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    }),
    runFallbackForType({
      model: ShiftRequest,
      requestType: "SHIFT",
      hospitalId,
      actor: req.user,
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    }),
  ]);
  return res.json({
    ok: true,
    escalated: { leave, overtime, shift, total: leave + overtime + shift },
    ranAt: new Date(),
  });
};
