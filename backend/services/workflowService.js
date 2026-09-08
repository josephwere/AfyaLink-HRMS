import WorkItem from "../models/WorkItem.js";
import { logAudit } from "./auditService.js";
import { notifyRolesInHospital } from "./notificationService.js";
import CashierShift from "../models/CashierShift.js";
import { resolveApprovers } from "./approverResolver.js";

function buildAssignmentsForUsers(level = {}, users = [], assignedAt = new Date()) {
  return (users || []).map((user) => ({
    level: Number(level.level || 0),
    approverId: user._id,
    approverRole: String(user.role || (level.roles && level.roles[0]) || "").toUpperCase(),
    status: "WAITING",
    delegatedTo: null,
    delegatedFrom: user.delegatedFor ? String(user.delegatedFor) : null,
    assignedAt,
    viewedAt: null,
    actionedAt: null,
    dueAt: null,
    comments: [],
    signature: null,
    metadata: {},
  }));
}

function buildAssignmentsForUserIds(level = {}) {
  const users = Array.isArray(level.users) ? level.users : [];
  return users.map((userId) => ({
    level: Number(level.level || 0),
    approverId: userId,
    approverRole: String((level.roles && level.roles[0]) || "").toUpperCase(),
    status: "WAITING",
    delegatedTo: null,
    delegatedFrom: null,
    assignedAt: new Date(),
    viewedAt: null,
    actionedAt: null,
    dueAt: null,
    comments: [],
    signature: null,
    metadata: {},
  }));
}

export async function createWorkItem({ hospital, type, module = "finance", priority = "MEDIUM", createdBy, metadata = {}, actionUrl = "" }) {
  // consult approval policy and resolve approvers if available
  let requiredApprovals = 1;
  let approvalLevels = [];
  let assignments = [];
  try {
    const amount = metadata.amount || 0;
    const resolved = await resolveApprovers({
      hospitalId: hospital,
      workflowType: type,
      amount,
      branch: metadata.branch || null,
      department: metadata.department || null,
    });
    if (resolved) {
      requiredApprovals = resolved.minimumApprovals || requiredApprovals;
      approvalLevels = resolved.resolvedLevels || [];
      const firstLevel = approvalLevels[0] || null;
      const currentCandidates = (resolved.candidates || []).find((candidate) => Number(candidate.level || 0) === 0);
      if (currentCandidates && currentCandidates.users && currentCandidates.users.length) {
        assignments = buildAssignmentsForUsers(firstLevel, currentCandidates.users);
      } else if (firstLevel && Array.isArray(firstLevel.users) && firstLevel.users.length) {
        assignments = buildAssignmentsForUserIds(firstLevel);
      }
      if (resolved.escalationHours) metadata.policyEscalationHours = resolved.escalationHours;
    }
  } catch (e) {}

  // initialize approval state inside metadata so we can track progress
  metadata = metadata || {};
  metadata.approvalState = metadata.approvalState || { currentLevel: 0, approvals: [] };
  const item = await WorkItem.create({ hospital, type, module, priority, createdBy, metadata, actionUrl, requiredApprovals, approvalLevels, assignments, slaHours: metadata.policyEscalationHours || 0 });
  try {
    await logAudit({ action: "WORKITEM_CREATED", resource: "WorkItem", resourceId: item._id, after: item, hospital, actorId: createdBy });
  } catch (e) {}
  try {
    await notifyRolesInHospital({ hospital, roles: ["FINANCE_MANAGER", "ACCOUNTANT"], title: `New ${type} created`, body: `A new ${type} requires review`, meta: { workItemId: String(item._id) } });
  } catch (e) {}
  return item;
}

export async function applyWorkItemAction({ workItemId, action, actorId, actorRole, payload = {} }) {
  const item = await WorkItem.findById(workItemId);
  if (!item) throw new Error("WorkItem not found");

  // record comments or delegation
  if (action === "comment") {
    item.comments.push({ actor: actorId, text: String(payload.text || "") });
    await item.save();
    await logAudit({ action: "WORKITEM_COMMENT", resource: "WorkItem", resourceId: item._id, after: item, hospital: item.hospital, actorId });
    return item;
  }

  if (action === "delegate") {
    item.assignedTo = payload.assignedTo || null;
    item.status = "IN_PROGRESS";
    await item.save();
    await logAudit({ action: "WORKITEM_DELEGATE", resource: "WorkItem", resourceId: item._id, after: item, hospital: item.hospital, actorId });
    return item;
  }

  // approval actions for known types
  if (action === "approve" || action === "reject") {
    // generic multi-level approval handling based on `approvalLevels` and assignment records
    const levels = item.approvalLevels || [];
    const currentIndex = Number(item.currentLevel || 0);
    const state = { currentLevel: currentIndex };
    const currentLevel = levels[currentIndex] || null;
    const currentAssignments = (item.assignments || []).filter((assignment) => Number(assignment.level) === currentIndex);

    // helper to push approval history
    const pushHistory = (act, comment) => {
      item.approvalHistory.push({ actor: actorId, action: act, comment: comment || "" });
    };

    // check self-approval when applicable (best-effort): if resource references a user in metadata
    if (item.metadata && item.metadata.cashier && String(item.metadata.cashier) === String(actorId)) {
      throw new Error("Approver must be different from the resource owner");
    }

    // if no configured levels, treat as single-level approval
    if (!currentLevel) {
      if (action === "approve") {
        pushHistory("APPROVE", payload.reason || "");
        item.status = "COMPLETED";
        item.comments.push({ actor: actorId, text: payload.reason || `Approved by ${actorRole}` });
      } else {
        pushHistory("REJECT", payload.reason || "");
        item.status = "COMPLETED";
        item.comments.push({ actor: actorId, text: payload.reason || `Rejected by ${actorRole}` });
      }
      await item.save();
      // handle known type side-effects even when no levels configured
      if (item.type === "SHIFT_APPROVAL") {
        const shiftId = item.metadata.shiftId;
        const shift = await CashierShift.findById(shiftId);
        if (shift) {
          if (action === "approve") {
            shift.status = "APPROVED";
            shift.approvedBy = actorId;
            shift.approvedAt = new Date();
            shift.lockedAt = new Date();
          } else {
            shift.status = "REJECTED";
            shift.rejectedBy = actorId;
            shift.rejectedAt = new Date();
            shift.rejectionReason = String(payload.reason || "Rejected");
          }
          await shift.save();
        }
      }
      await logAudit({ action: `WORKITEM_${action.toUpperCase()}`, resource: "WorkItem", resourceId: item._id, after: item, hospital: item.hospital, actorId });
      try {
        await notifyRolesInHospital({ hospital: item.hospital, roles: ["HOSPITAL_ADMIN", "FINANCE_MANAGER"], title: `Work item ${action}d`, body: `Work item ${String(item._id)} ${action}d`, meta: { workItemId: String(item._id) } });
      } catch (e) {}
      return item;
    }

    // verify actor is allowed at this level (by role or explicit users)
    const actorRoleUp = String(actorRole || "").toUpperCase();
    const allowedRoles = (currentLevel.roles || []).map((r) => String(r).toUpperCase());
    const allowedUsers = (currentLevel.users || []).map((u) => String(u));
    const actorAssignment = currentAssignments.find((assignment) => String(assignment.approverId) === String(actorId));
    const isAllowed = Boolean(
      actorAssignment ||
        allowedRoles.includes(actorRoleUp) ||
        allowedUsers.includes(String(actorId)) ||
        String(item.assignedTo) === String(actorId)
    );
    if (!isAllowed) throw new Error("Actor not authorized to act on this approval level");

    // record the action
    if (action === "approve") {
      pushHistory("APPROVE", payload.reason || "");
      item.comments.push({ actor: actorId, text: payload.reason || `Approved by ${actorRole}` });

      if (actorAssignment) {
        actorAssignment.status = "APPROVED";
        actorAssignment.actionedAt = new Date();
        if (payload.reason) {
          actorAssignment.comments.push({ actor: actorId, text: String(payload.reason) });
        }
      }

      const approvalsForLevel = currentAssignments.filter((assignment) => assignment.status === "APPROVED").length;
      const minApprovals = currentLevel.minimumApprovals || 1;

      if (currentLevel.mode === "PARALLEL") {
        if (approvalsForLevel >= minApprovals) {
          state.currentLevel = currentIndex + 1;
          currentAssignments.forEach((assignment) => {
            if (assignment.status === "WAITING") assignment.status = "EXPIRED";
          });
        }
      } else {
        state.currentLevel = currentIndex + 1;
        currentAssignments.forEach((assignment) => {
          if (assignment.status === "WAITING") assignment.status = "EXPIRED";
        });
      }
    } else {
      // reject: terminate work item and record
      pushHistory("REJECT", payload.reason || "");
      item.comments.push({ actor: actorId, text: payload.reason || `Rejected by ${actorRole}` });
      if (actorAssignment) {
        actorAssignment.status = "REJECTED";
        actorAssignment.actionedAt = new Date();
        if (payload.reason) {
          actorAssignment.comments.push({ actor: actorId, text: String(payload.reason) });
        }
      }
      item.status = "COMPLETED";
      item.overallStatus = "REJECTED";
      await item.save();
      await logAudit({ action: `WORKITEM_REJECT`, resource: "WorkItem", resourceId: item._id, after: item, hospital: item.hospital, actorId });
      try {
        await notifyRolesInHospital({ hospital: item.hospital, roles: ["HOSPITAL_ADMIN", "FINANCE_MANAGER"], title: `Work item rejected`, body: `Work item ${String(item._id)} was rejected`, meta: { workItemId: String(item._id) } });
      } catch (e) {}
      return item;
    }

    // update state and persist
    item.metadata = item.metadata || {};
    item.metadata.approvalState = { currentLevel: state.currentLevel, approvals: item.approvalHistory.filter((h) => h.action === "APPROVE") };
    item.currentLevel = state.currentLevel;
    item.overallStatus = state.currentLevel >= levels.length ? "APPROVED" : "IN_PROGRESS";

    // if we've advanced past last level, mark completed
    if (state.currentLevel >= (levels || []).length) {
      item.status = "COMPLETED";
      try {
        await logAudit({ action: `WORKITEM_${action.toUpperCase()}_COMPLETED`, resource: "WorkItem", resourceId: item._id, after: item, hospital: item.hospital, actorId });
      } catch (e) {}
      try {
        await notifyRolesInHospital({ hospital: item.hospital, roles: ["HOSPITAL_ADMIN", "FINANCE_MANAGER"], title: `Work item completed`, body: `Work item ${String(item._id)} completed`, meta: { workItemId: String(item._id) } });
      } catch (e) {}

      // handle known type side-effects
      if (item.type === "SHIFT_APPROVAL") {
        const shiftId = item.metadata.shiftId;
        const shift = await CashierShift.findById(shiftId);
        if (shift) {
          shift.status = "APPROVED";
          shift.approvedBy = actorId;
          shift.approvedAt = new Date();
          shift.lockedAt = new Date();
          await shift.save();
          return { item, shift };
        }
      }
    } else {
      const nextLevelIndex = state.currentLevel;
      const nextLevel = levels[nextLevelIndex] || null;
      if (nextLevel) {
        item.assignments = item.assignments || [];
        if (!item.assignments.some((assignment) => Number(assignment.level) === nextLevelIndex)) {
          item.assignments.push(...buildAssignmentsForUserIds(nextLevel));
        }
        if (nextLevel.roles) {
          try {
            await notifyRolesInHospital({ hospital: item.hospital, roles: nextLevel.roles, title: `Action required: ${item.type}`, body: `A work item needs your attention`, meta: { workItemId: String(item._id), level: state.currentLevel } });
          } catch (e) {}
        }
      }
      item.status = "IN_PROGRESS";
    }

    await item.save();
    return item;
  }

  throw new Error("Unsupported action");
}
import Appointment from "../models/Appointment.js";
import AppointmentTimeline from "../models/AppointmentTimeline.js";
import Encounter from "../models/Encounter.js";
import { v4 as uuid } from "uuid";

const VALID_APPOINTMENT_TRANSITIONS = {
  Scheduled: ["CheckedIn", "Cancelled"],
  CheckedIn: ["ProviderReady", "Cancelled"],
  ProviderReady: ["InConsultation", "Cancelled"],
  InConsultation: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  NoShow: [],
};

function normalizeAppointmentStatus(status) {
  if (!status) return null;
  const raw = String(status).trim();
  const upper = raw.toUpperCase();
  const aliases = {
    CREATED: "Scheduled",
    CONFIRMED: "Scheduled",
    SCHEDULED: "Scheduled",
    CHECKED_IN: "CheckedIn",
    CHECKEDIN: "CheckedIn",
    WAITING: "CheckedIn",
    PROVIDER_READY: "ProviderReady",
    PROVIDERREADY: "ProviderReady",
    READY_FOR_PROVIDER: "ProviderReady",
    INCONSULTATION: "InConsultation",
    IN_CONSULTATION: "InConsultation",
    OPENING_ENCOUNTER: "InConsultation",
    IN_ENCOUNTER: "InConsultation",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NOSHOW: "NoShow",
    NO_SHOW: "NoShow",
    RESCHEDULED: "Scheduled",
    EXPIRED: "Cancelled",
  };

  if (aliases[upper]) return aliases[upper];
  if (["Scheduled", "CheckedIn", "ProviderReady", "InConsultation", "Completed", "Cancelled", "NoShow"].includes(raw)) {
    return raw;
  }
  return raw;
}

function buildInvalidTransitionError(currentStatus, targetStatus) {
  const error = new Error(
    `Cannot transition appointment from ${currentStatus} to ${targetStatus}`
  );
  error.statusCode = 409;
  error.code = "INVALID_APPOINTMENT_TRANSITION";
  return error;
}

class WorkflowService {
  getAllowedActions(appointment = {}, actor = {}) {
    const normalizedStatus = normalizeAppointmentStatus(appointment?.status);
    const role = String(actor?.role || "SYSTEM").trim().toUpperCase();
    const activeRoles = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "SYSTEM"];
    const clinicalRoles = ["ADMIN", "DOCTOR", "NURSE", "SYSTEM"];
    const base = {
      canCancel: false,
      canCheckIn: false,
      canMarkProviderReady: false,
      canStartConsultation: false,
      canComplete: false,
    };

    if (normalizedStatus === "Scheduled") {
      base.canCheckIn = activeRoles.includes(role);
      base.canCancel = activeRoles.includes(role);
      return base;
    }

    if (normalizedStatus === "CheckedIn") {
      base.canMarkProviderReady = activeRoles.includes(role);
      base.canCancel = activeRoles.includes(role);
      return base;
    }

    if (normalizedStatus === "ProviderReady") {
      base.canStartConsultation = clinicalRoles.includes(role);
      base.canCancel = activeRoles.includes(role);
      return base;
    }

    if (normalizedStatus === "InConsultation") {
      base.canComplete = ["ADMIN", "DOCTOR", "SYSTEM"].includes(role);
      base.canCancel = activeRoles.includes(role);
      return base;
    }

    return base;
  }

  /**
   * START a workflow (entry point)
   */
  async start(type, context, { session } = {}) {
    if (type !== "CONSULTATION") {
      throw new Error("Unsupported workflow type");
    }

    const workflowId = uuid();

    const appointment = new Appointment({
      ...context,
      workflowId,
      status: "Scheduled",
      assignmentStatus: context.doctor ? "ASSIGNED" : "PENDING",
    });
    appointment.$locals = { ...(appointment.$locals || {}), viaWorkflow: true };
    await appointment.save({ session });

    return {
      id: workflowId,
      state: "Scheduled",
      context: { appointment },
    };
  }

  /**
   * TRANSITION a workflow
   */
  async transition(type, workflowId, { updates = {}, cancel = false, session, actor = null } = {}) {
    if (type !== "CONSULTATION") {
      throw new Error("Unsupported workflow type");
    }

    const appointment = await Appointment.findOne({ workflowId }).session(session || null);
    if (!appointment) throw new Error("Workflow not found");

    const currentStatus = normalizeAppointmentStatus(appointment.status);
    const requestedStatus = updates?.status
      ? normalizeAppointmentStatus(updates.status)
      : null;
    const actorId = actor?._id || actor?.id || null;
    const actorRole = String(actor?.role || "SYSTEM").trim().toUpperCase();
    const normalizedActorRole = ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "SYSTEM", "PATIENT"].includes(actorRole)
      ? actorRole
      : "SYSTEM";

    if (!cancel) {
      if (requestedStatus) {
        const allowed = VALID_APPOINTMENT_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(requestedStatus)) {
          throw buildInvalidTransitionError(currentStatus, requestedStatus);
        }
      }
    }

    if (cancel) {
      appointment.status = "Cancelled";
      Object.assign(appointment, updates);
    } else {
      Object.assign(appointment, updates);
      if (requestedStatus) {
        appointment.status = requestedStatus;
      }
    }

    if (requestedStatus && requestedStatus !== currentStatus) {
      if (requestedStatus === "CheckedIn") {
        if (!appointment.checkedInAt) appointment.checkedInAt = new Date();
        if (!appointment.checkedInBy) appointment.checkedInBy = actorId;
        if (!appointment.waitingSince) appointment.waitingSince = appointment.checkedInAt;
      }

      if (requestedStatus === "ProviderReady") {
        if (!appointment.providerReadyAt) appointment.providerReadyAt = new Date();
        if (!appointment.providerReadyBy) appointment.providerReadyBy = actorId;
        if (!appointment.waitingSince && appointment.checkedInAt) appointment.waitingSince = appointment.checkedInAt;
      }
    }

    appointment.$locals = { ...(appointment.$locals || {}), viaWorkflow: true };
    await appointment.save({ session });

    if (requestedStatus && requestedStatus !== currentStatus) {
      const timelineAction = {
        CheckedIn: "CHECKED_IN",
        ProviderReady: "READY_FOR_PROVIDER",
        InConsultation: "IN_ENCOUNTER",
        Completed: "COMPLETED",
        Cancelled: "CANCELLED",
        NoShow: "NO_SHOW",
      }[requestedStatus];

      if (timelineAction) {
        await AppointmentTimeline.create({
          appointment: appointment._id,
          action: timelineAction,
          actor: actorId,
          actorRole: normalizedActorRole,
          timestamp: new Date(),
          metadata: {
            fromStatus: currentStatus,
            toStatus: requestedStatus,
            source: "workflowService",
          },
        });
      }
    }

    return {
      id: workflowId,
      state: appointment.status,
      context: { appointment },
    };
  }

  /**
   * ENCOUNTER-level transition (clinical)
   */
  async transitionEncounter(encounterId, nextState, payload = {}, { session } = {}) {
    const encounter = await Encounter.findById(encounterId);
    if (!encounter) throw new Error("Encounter not found");

    encounter.state = nextState;

    if (payload.notes) encounter.consultationNotes = payload.notes;
    if (payload.diagnosis) encounter.diagnosis = payload.diagnosis;
    if (payload.labOrderId) encounter.labOrders.push(payload.labOrderId);
    if (payload.prescriptionId) {
      encounter.prescriptions.push(payload.prescriptionId);
    }
    if (payload.billId) encounter.bill = payload.billId;

    if (nextState === "CLOSED") {
      encounter.closedAt = new Date();
    }

    encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
    await encounter.save({ session });
    return encounter;
  }
}

/**
 * ✅ CREATE INSTANCE
 */
const workflowService = new WorkflowService();

/**
 * ✅ EXPORT BOTH (THIS IS THE FIX)
 */
export { workflowService };
export default workflowService;
