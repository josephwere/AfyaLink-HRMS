import Workflow from "../models/Workflow.js";
import { WORKFLOW_SLA } from "../constants/workflowSLA.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import WorkflowSlaPolicy from "../models/WorkflowSlaPolicy.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import {
  WORKFORCE_REQUEST_TYPES,
  WORKFORCE_SLA_DEFAULTS,
} from "../constants/workforceSLA.js";
import { logAudit } from "./auditService.js";

async function checkClinicalWorkflowSLA() {
  const workflows = await Workflow.find({
    state: { $in: Object.keys(WORKFLOW_SLA) },
  });

  const now = Date.now();
  let alerts = 0;

  for (const wf of workflows) {
    const rule = WORKFLOW_SLA[wf.state];
    if (!rule) continue;

    const enteredAt =
      wf.history?.slice().reverse().find(h => h.state === wf.state)?.at;

    if (!enteredAt) continue;

    const minutes =
      (now - new Date(enteredAt).getTime()) / 60000;

    if (minutes > rule.maxMinutes) {
      alerts += 1;
      await logAudit({
        action: rule.alert,
        resource: "workflow",
        resourceId: wf._id,
        after: {
          state: wf.state,
          delayedMinutes: Math.round(minutes),
        },
      });
    }
  }
  return { alerts, scanned: workflows.length };
}

function policyCacheKey(hospitalId, requestType) {
  return `${String(hospitalId || "")}:${requestType}`;
}

async function resolveWorkforcePolicy(hospitalId, requestType, cache) {
  const key = policyCacheKey(hospitalId, requestType);
  if (cache.has(key)) return cache.get(key);

  const stored = await WorkflowSlaPolicy.findOne({
    hospital: hospitalId,
    requestType,
    active: true,
  })
    .lean()
    .select("targetMinutes escalationMinutes active");

  const policy = stored || WORKFORCE_SLA_DEFAULTS[requestType];
  cache.set(key, policy || null);
  return policy || null;
}

async function notifyEscalationTargets({ hospitalId, requestType, requestId, level, delayedMinutes }) {
  const hospitalRoles = ["HOSPITAL_ADMIN", "HR_MANAGER"];
  const globalRoles = level >= 2 ? ["SUPER_ADMIN", "SYSTEM_ADMIN"] : [];

  const users = await User.find({
    $or: [
      { hospital: hospitalId, role: { $in: hospitalRoles } },
      ...(globalRoles.length ? [{ role: { $in: globalRoles } }] : []),
    ],
  })
    .select("_id hospital")
    .lean();

  if (!users.length) return;

  const title = level >= 2 ? "Workflow SLA Escalated" : "Workflow SLA Breach";
  const body =
    level >= 2
      ? `${requestType} request requires urgent action (${delayedMinutes}m delayed).`
      : `${requestType} request exceeded SLA by ${delayedMinutes}m.`;

  await Notification.insertMany(
    users.map((u) => ({
      title,
      body,
      user: u._id,
      hospital: hospitalId,
      category: "WORKFORCE",
      meta: {
        type: "WORKFORCE_SLA",
        requestType,
        requestId,
        escalationLevel: level,
        delayedMinutes,
      },
    }))
  );
}

async function processPendingRequestSLA({ model, requestType, now, policyCache }) {
  const items = await model
    .find({ status: "PENDING" })
    .select(
      "_id hospital createdAt slaDueAt slaBreachedAt escalationLevel lastEscalatedAt"
    )
    .sort({ createdAt: 1 })
    .limit(1500);

  let updatesCount = 0;
  let escalationsL1 = 0;
  let escalationsL2 = 0;

  for (const item of items) {
    const policy = await resolveWorkforcePolicy(item.hospital, requestType, policyCache);
    if (!policy?.active) continue;

    const createdAt = new Date(item.createdAt);
    const dueAt = item.slaDueAt
      ? new Date(item.slaDueAt)
      : new Date(createdAt.getTime() + policy.targetMinutes * 60 * 1000);
    const escalationAt = new Date(createdAt.getTime() + policy.escalationMinutes * 60 * 1000);

    const delayedMinutes = Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / 60000));
    const currentLevel = item.escalationLevel || 0;
    let nextLevel = currentLevel;
    const updates = {};

    if (!item.slaDueAt) updates.slaDueAt = dueAt;

    if (now >= dueAt && currentLevel < 1) {
      nextLevel = 1;
      updates.slaBreachedAt = item.slaBreachedAt || now;
      updates.escalationLevel = 1;
      updates.lastEscalatedAt = now;
    }

    if (now >= escalationAt && currentLevel < 2) {
      nextLevel = 2;
      updates.slaBreachedAt = item.slaBreachedAt || now;
      updates.escalationLevel = 2;
      updates.lastEscalatedAt = now;
    }

    if (Object.keys(updates).length) {
      await model.updateOne({ _id: item._id }, { $set: updates });
      updatesCount += 1;
    }

    if (nextLevel > currentLevel) {
      if (nextLevel >= 2) escalationsL2 += 1;
      else escalationsL1 += 1;

      await notifyEscalationTargets({
        hospitalId: item.hospital,
        requestType,
        requestId: item._id,
        level: nextLevel,
        delayedMinutes,
      });

      await logAudit({
        action:
          nextLevel >= 2
            ? "WORKFORCE_SLA_ESCALATION_LEVEL2"
            : "WORKFORCE_SLA_ESCALATION_LEVEL1",
        resource: "workforce_request",
        resourceId: item._id,
        hospital: item.hospital,
        after: {
          requestType,
          escalationLevel: nextLevel,
          delayedMinutes,
        },
      });
    }
  }

  return {
    scanned: items.length,
    updates: updatesCount,
    escalationsL1,
    escalationsL2,
  };
}

async function checkWorkforceSLA() {
  const now = new Date();
  const policyCache = new Map();
  const handlers = {
    LEAVE: LeaveRequest,
    OVERTIME: OvertimeRequest,
    SHIFT: ShiftRequest,
  };

  const summary = {
    scanned: 0,
    updates: 0,
    escalationsL1: 0,
    escalationsL2: 0,
    byType: {},
  };

  for (const requestType of WORKFORCE_REQUEST_TYPES) {
    const model = handlers[requestType];
    if (!model) continue;
    const result = await processPendingRequestSLA({
      model,
      requestType,
      now,
      policyCache,
    });
    summary.byType[requestType] = result;
    summary.scanned += result.scanned;
    summary.updates += result.updates;
    summary.escalationsL1 += result.escalationsL1;
    summary.escalationsL2 += result.escalationsL2;
  }
  return summary;
}

export async function checkWorkflowSLA() {
  const clinical = await checkClinicalWorkflowSLA();
  const workforce = await checkWorkforceSLA();
  return { clinical, workforce };
}
