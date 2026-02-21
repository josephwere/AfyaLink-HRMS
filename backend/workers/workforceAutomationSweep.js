import WorkflowAutomationPolicy from "../models/WorkflowAutomationPolicy.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

const FALLBACK_ROLES = new Set([
  "HOSPITAL_ADMIN",
  "SYSTEM_ADMIN",
  "SUPER_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
]);

const REQUEST_MODEL_BY_TYPE = {
  LEAVE: LeaveRequest,
  OVERTIME: OvertimeRequest,
  SHIFT: ShiftRequest,
};

async function notifyRoleUsers({ hospitalId, role, requestType, count }) {
  const users = await User.find({ hospital: hospitalId, role }).select("_id").lean();
  if (!users.length) return;

  await Notification.insertMany(
    users.map((user) => ({
      title: "Approval Escalation Required",
      body: `${count} ${requestType} requests exceeded L2 approval SLA.`,
      user: user._id,
      hospital: hospitalId,
      category: "WORKFORCE",
      meta: { type: requestType, escalated: true, count },
    }))
  );
}

async function processPolicy(policy) {
  const model = REQUEST_MODEL_BY_TYPE[policy.requestType];
  if (!model) return 0;

  const hospitalId = policy.hospital;
  const fallbackRole = FALLBACK_ROLES.has(policy.fallbackRole)
    ? policy.fallbackRole
    : "HOSPITAL_ADMIN";
  const minutes = Number(policy.escalationAfterMinutes || 120);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const rows = await model
    .find({
      hospital: hospitalId,
      status: "PENDING",
      approvalStage: "L2_PENDING",
      stageOneApprovedAt: { $lte: cutoff },
      $or: [{ escalatedAt: null }, { escalatedAt: { $exists: false } }],
    })
    .select("_id")
    .limit(500)
    .lean();

  if (!rows.length) return 0;

  const now = new Date();
  await model.updateMany(
    { _id: { $in: rows.map((r) => r._id) } },
    { $set: { escalatedAt: now, fallbackRole }, $inc: { escalationLevel: 1 } }
  );

  await notifyRoleUsers({
    hospitalId,
    role: fallbackRole,
    requestType: policy.requestType,
    count: rows.length,
  });

  await AuditLog.create({
    action: "WORKFORCE_L2_ESCALATION_DISPATCHED",
    actorRole: "SYSTEM",
    resource: `${policy.requestType.toLowerCase()}_request`,
    hospital: hospitalId,
    metadata: {
      requestType: policy.requestType,
      fallbackRole,
      count: rows.length,
      source: "scheduled_worker",
    },
    success: true,
  });

  return rows.length;
}

export async function runWorkforceAutomationSweep() {
  const policies = await WorkflowAutomationPolicy.find({
    active: true,
    requireSecondApprover: true,
  })
    .select("hospital requestType fallbackRole escalationAfterMinutes")
    .lean();

  if (!policies.length) return { scannedPolicies: 0, escalated: 0 };

  let escalated = 0;
  for (const policy of policies) {
    escalated += await processPolicy(policy);
  }

  return { scannedPolicies: policies.length, escalated };
}
