import mongoose from "mongoose";
import { normalizeRole } from "../utils/normalizeRole.js";
import CommunicationChannel from "../models/CommunicationChannel.js";
import CommunicationMessage from "../models/CommunicationMessage.js";
import CallSession from "../models/CallSession.js";
import SupportTicket from "../models/SupportTicket.js";
import Claim from "../models/Claim.js";
import Invoice from "../models/Invoice.js";
import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import UnifiedAssistantWorkspace from "../models/UnifiedAssistantWorkspace.js";
import { logAudit } from "../services/auditService.js";

const { Types } = mongoose;

const GLOBAL_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "SUPER_ASSISTANT"]);
const OPEN_TICKET_STATUSES = ["OPEN", "ASSIGNED", "ESCALATED"];
const CLAIM_ALERT_STATUSES = ["SUBMITTED", "REVIEW_REQUIRED"];
const ASSISTANT_MODE_VALUES = new Set(["ASSIST", "AUTO", "TAKEOVER"]);
const ASSISTANT_AVAILABILITY_VALUES = new Set(["AVAILABLE", "BUSY", "AWAY", "OFFLINE"]);
const ASSISTANT_AUDIT_ACTIONS = [
  "UNIFIED_ASSISTANT_MODE_UPDATED",
  "UNIFIED_ASSISTANT_AVAILABILITY_UPDATED",
  "UNIFIED_ASSISTANT_HANDOFF_LOGGED",
];

function actorRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

function canQueryGlobally(req) {
  return GLOBAL_ROLES.has(actorRole(req));
}

function resolveHospitalScope(req) {
  const requested = String(req.query?.hospitalId || req.query?.hospital || "").trim();
  if (canQueryGlobally(req)) return requested || null;
  return req.user?.hospitalId || req.user?.hospital || null;
}

function toObjectId(value) {
  return Types.ObjectId.isValid(String(value || "")) ? new Types.ObjectId(String(value)) : null;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patientName(patient) {
  if (!patient) return "Patient";
  const full = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  return full || patient.nationalId || patient.countryId || "Patient";
}

function userName(user) {
  if (!user) return "User";
  return user.name || user.email || user.phone || "User";
}

function hospitalScopeFilter(field, hospitalId) {
  if (!hospitalId) return {};
  return { [field]: hospitalId };
}

function workspaceScopeKey(hospitalId) {
  return hospitalId ? String(hospitalId) : "GLOBAL";
}

function defaultWorkspaceState(hospitalId = null) {
  return {
    scopeKey: workspaceScopeKey(hospitalId),
    hospital: hospitalId || null,
    operatingMode: "ASSIST",
    humanAvailability: {
      status: "AVAILABLE",
      note: "",
      updatedAt: null,
      updatedBy: null,
    },
    handoffPolicy: {
      autoReplyWhenUnavailable: true,
      autoEscalateCritical: true,
      requireReasonForTakeover: false,
    },
    takeover: {
      active: false,
      reason: "",
      entityKind: "",
      entityId: "",
      startedAt: null,
      startedBy: null,
    },
    lastAutoHandledAt: null,
    lastHumanHandledAt: null,
    updatedAt: null,
    createdAt: null,
  };
}

function serializeWorkspaceState(doc, hospitalId = null) {
  const fallback = defaultWorkspaceState(hospitalId);
  if (!doc) return fallback;
  return {
    scopeKey: doc.scopeKey || fallback.scopeKey,
    hospital: doc.hospital || fallback.hospital,
    operatingMode: doc.operatingMode || fallback.operatingMode,
    humanAvailability: {
      ...fallback.humanAvailability,
      ...(doc.humanAvailability || {}),
    },
    handoffPolicy: {
      ...fallback.handoffPolicy,
      ...(doc.handoffPolicy || {}),
    },
    takeover: {
      ...fallback.takeover,
      ...(doc.takeover || {}),
    },
    lastAutoHandledAt: doc.lastAutoHandledAt || null,
    lastHumanHandledAt: doc.lastHumanHandledAt || null,
    updatedAt: doc.updatedAt || null,
    createdAt: doc.createdAt || null,
  };
}

async function getWorkspaceStateDoc(hospitalId = null) {
  const scopeKey = workspaceScopeKey(hospitalId);
  let doc = await UnifiedAssistantWorkspace.findOne({ scopeKey }).lean();
  if (doc) return doc;
  const hospitalObjectId = toObjectId(hospitalId);
  doc = await UnifiedAssistantWorkspace.create({
    scopeKey,
    hospital: hospitalObjectId,
    ...defaultWorkspaceState(hospitalObjectId),
  });
  return doc.toObject();
}

function assistantAuditScopeFilter(hospitalId = null) {
  const hospitalObjectId = toObjectId(hospitalId);
  if (hospitalObjectId) {
    return {
      $or: [
        { hospital: hospitalObjectId },
        { "metadata.scopeKey": workspaceScopeKey(hospitalObjectId) },
      ],
    };
  }
  return { "metadata.scopeKey": "GLOBAL" };
}

async function listWorkspaceAuditLogs(hospitalId = null, limit = 12) {
  const rows = await AuditLog.find({
    action: { $in: ASSISTANT_AUDIT_ACTIONS },
    ...assistantAuditScopeFilter(hospitalId),
  })
    .populate("actorId", "name email role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    _id: row._id,
    action: row.action,
    actor: userName(row.actorId),
    actorRole: row.actorRole || row.actorId?.role || "",
    createdAt: row.createdAt,
    note: row.metadata?.note || "",
    fromMode: row.metadata?.fromMode || "",
    toMode: row.metadata?.toMode || "",
    fromAvailability: row.metadata?.fromAvailability || "",
    toAvailability: row.metadata?.toAvailability || "",
    entityKind: row.metadata?.entityKind || "",
    entityId: row.metadata?.entityId || "",
    scopeKey: row.metadata?.scopeKey || workspaceScopeKey(hospitalId),
  }));
}

async function buildChannelSnapshots(hospitalId) {
  const [channels, latestRows] = await Promise.all([
    CommunicationChannel.find({ active: true, ...hospitalScopeFilter("hospital", hospitalId) })
      .select("name description participantRoles hospital updatedAt")
      .populate("hospital", "name code verification.status")
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean(),
    CommunicationMessage.aggregate([
      { $match: hospitalId ? { hospital: toObjectId(hospitalId) } : {} },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$channel",
          latestBody: { $first: "$body" },
          latestSenderRole: { $first: "$senderRole" },
          latestCreatedAt: { $first: "$createdAt" },
        },
      },
    ]),
  ]);

  const latestMap = new Map(
    latestRows.map((row) => [String(row._id), {
      body: row.latestBody,
      senderRole: row.latestSenderRole,
      createdAt: row.latestCreatedAt,
    }])
  );

  return channels.map((channel) => ({
    ...channel,
    lastMessage: latestMap.get(String(channel._id)) || null,
  }));
}

async function buildOverview(req, res, next) {
  try {
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);

    const claimAlertFilter = {
      ...hospitalScopeFilter("hospital", hospitalObjectId),
      $or: [
        { status: { $in: CLAIM_ALERT_STATUSES } },
        { riskScore: { $gte: 65 } },
        { "riskSignals.0": { $exists: true } },
      ],
    };

    const [
      channels,
      calls,
      tickets,
      claimAlerts,
      metricsCounts,
      claimTotals,
      invoiceTotals,
      errorLogs,
      watchlist,
      workspace,
      handoffLogs,
    ] = await Promise.all([
      buildChannelSnapshots(hospitalObjectId),
      CallSession.find({
        ...hospitalScopeFilter("hospital", hospitalObjectId),
        deletedAt: { $exists: false },
      })
        .populate("patient", "firstName lastName nationalId")
        .populate("doctor", "name role")
        .populate("hospital", "name code verification.status")
        .populate("appointment", "serviceType scheduledAt status")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      SupportTicket.find({
        ...hospitalScopeFilter("hospital", hospitalObjectId),
        status: { $in: OPEN_TICKET_STATUSES },
      })
        .populate("hospital", "name code")
        .populate("requester", "name email role")
        .populate("assignee", "name email role")
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      Claim.find(claimAlertFilter)
        .populate("hospital", "name code verification.status")
        .populate("patient", "firstName lastName nationalId")
        .sort({ riskScore: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      Promise.all([
        CommunicationChannel.countDocuments({ active: true, ...hospitalScopeFilter("hospital", hospitalObjectId) }),
        CallSession.countDocuments({ ...hospitalScopeFilter("hospital", hospitalObjectId), deletedAt: { $exists: false }, status: { $in: ["REQUESTED", "ACTIVE"] } }),
        SupportTicket.countDocuments({ ...hospitalScopeFilter("hospital", hospitalObjectId), status: { $in: OPEN_TICKET_STATUSES } }),
        Claim.countDocuments(claimAlertFilter),
        Claim.countDocuments({ ...hospitalScopeFilter("hospital", hospitalObjectId), status: { $in: CLAIM_ALERT_STATUSES } }),
        Invoice.countDocuments({ ...hospitalScopeFilter("hospital", hospitalObjectId), status: "Unpaid" }),
        AuditLog.countDocuments({ ...hospitalScopeFilter("hospital", hospitalObjectId), success: false }),
      ]),
      Claim.aggregate([
        { $match: hospitalObjectId ? { hospital: hospitalObjectId } : {} },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: hospitalObjectId ? { hospital: hospitalObjectId } : {} },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ["$total", 0] } },
          },
        },
      ]),
      AuditLog.find({
        ...hospitalScopeFilter("hospital", hospitalObjectId),
        success: false,
      })
        .populate("actorId", "name role")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Claim.aggregate([
        { $match: hospitalObjectId ? { hospital: hospitalObjectId } : {} },
        {
          $group: {
            _id: "$hospital",
            pendingClaims: {
              $sum: {
                $cond: [{ $in: ["$status", CLAIM_ALERT_STATUSES] }, 1, 0],
              },
            },
            fraudAlerts: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $gte: ["$riskScore", 65] },
                      { $gt: [{ $size: { $ifNull: ["$riskSignals", []] } }, 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          },
        },
        { $sort: { fraudAlerts: -1, pendingClaims: -1, totalAmount: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: "hospitals",
            localField: "_id",
            foreignField: "_id",
            as: "hospital",
          },
        },
        { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            pendingClaims: 1,
            fraudAlerts: 1,
            totalAmount: 1,
            name: "$hospital.name",
            code: "$hospital.code",
            verificationStatus: "$hospital.verification.status",
            active: "$hospital.active",
          },
        },
      ]),
      getWorkspaceStateDoc(hospitalObjectId),
      listWorkspaceAuditLogs(hospitalObjectId, 10),
    ]);

    const [activeChats, activeCalls, openTickets, fraudAlerts, pendingClaims, unpaidInvoices, systemErrors] = metricsCounts;

    const claimSummary = claimTotals.reduce((acc, row) => {
      acc[row._id || "UNKNOWN"] = { count: row.count, totalAmount: row.totalAmount };
      return acc;
    }, {});

    const invoiceSummary = invoiceTotals.reduce((acc, row) => {
      acc[row._id || "UNKNOWN"] = { count: row.count, totalAmount: row.totalAmount };
      return acc;
    }, {});

    const alerts = [
      ...claimAlerts.slice(0, 6).map((claim) => ({
        id: `claim-${claim._id}`,
        type: "FRAUD_ALERT",
        severity: claim.riskScore >= 85 ? "CRITICAL" : claim.riskScore >= 70 ? "HIGH" : "MEDIUM",
        title: `${claim.hospital?.name || claim.hospitalSnapshot?.name || "Hospital"} claim flagged`,
        subtitle: `${patientName(claim.patient)} • ${claim.status}`,
        entityKind: "claim",
        entityId: claim._id,
        createdAt: claim.createdAt,
        riskScore: claim.riskScore || 0,
        flags: Array.isArray(claim.riskFlags) ? claim.riskFlags : [],
      })),
      ...tickets
        .filter((ticket) => ticket.status === "ESCALATED" || ticket.priority === "CRITICAL")
        .slice(0, 4)
        .map((ticket) => ({
          id: `ticket-${ticket._id}`,
          type: "SUPPORT_ESCALATION",
          severity: ticket.priority === "CRITICAL" ? "HIGH" : "MEDIUM",
          title: ticket.title,
          subtitle: `${ticket.ticketKey} • ${ticket.status}`,
          entityKind: "ticket",
          entityId: ticket._id,
          createdAt: ticket.updatedAt,
          riskScore: null,
          flags: [ticket.category, ticket.priority].filter(Boolean),
        })),
      ...errorLogs.slice(0, 4).map((log) => ({
        id: `audit-${log._id}`,
        type: "SYSTEM_ERROR",
        severity: "MEDIUM",
        title: log.action || "Failed operation",
        subtitle: log.error || log.resource || "Audit failure",
        entityKind: "audit",
        entityId: log._id,
        createdAt: log.createdAt,
        riskScore: null,
        flags: [log.actorRole, log.resource].filter(Boolean),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 12);

    return res.json({
      summary: {
        activeChats,
        activeCalls,
        openTickets,
        fraudAlerts,
        pendingClaims,
        unpaidInvoices,
        systemErrors,
      },
      channels,
      calls,
      tickets,
      alerts,
      financialSummary: {
        claims: claimSummary,
        invoices: invoiceSummary,
      },
      developerSignals: errorLogs.map((log) => ({
        _id: log._id,
        action: log.action,
        resource: log.resource,
        error: log.error,
        actor: userName(log.actorId),
        actorRole: log.actorRole,
        createdAt: log.createdAt,
      })),
      hospitalWatchlist: watchlist,
      assistantWorkspace: serializeWorkspaceState(workspace, hospitalObjectId),
      assistantHandoffLogs: handoffLogs,
      scope: {
        hospitalId: hospitalId || null,
        global: canQueryGlobally(req),
        actorRole: actorRole(req),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getUnifiedAssistantSettings(req, res, next) {
  try {
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);
    const [workspace, handoffLogs] = await Promise.all([
      getWorkspaceStateDoc(hospitalObjectId),
      listWorkspaceAuditLogs(hospitalObjectId, 20),
    ]);

    return res.json({
      settings: serializeWorkspaceState(workspace, hospitalObjectId),
      handoffLogs,
      scope: {
        hospitalId: hospitalId || null,
        global: canQueryGlobally(req),
        actorRole: actorRole(req),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function updateUnifiedAssistantSettings(req, res, next) {
  try {
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);
    const scopeKey = workspaceScopeKey(hospitalObjectId);
    const existing = await getWorkspaceStateDoc(hospitalObjectId);
    const before = serializeWorkspaceState(existing, hospitalObjectId);

    const nextMode = String(req.body?.operatingMode || before.operatingMode || "ASSIST").toUpperCase();
    if (!ASSISTANT_MODE_VALUES.has(nextMode)) {
      return res.status(422).json({ message: "Invalid operating mode" });
    }

    const nextAvailability = String(
      req.body?.humanAvailability?.status || before.humanAvailability?.status || "AVAILABLE"
    ).toUpperCase();
    if (!ASSISTANT_AVAILABILITY_VALUES.has(nextAvailability)) {
      return res.status(422).json({ message: "Invalid human availability status" });
    }

    const hasHandoffNote = Object.prototype.hasOwnProperty.call(req.body || {}, "handoffNote");
    const hasAvailabilityNote = Object.prototype.hasOwnProperty.call(req.body?.humanAvailability || {}, "note");
    const note = String(
      hasHandoffNote
        ? req.body?.handoffNote
        : hasAvailabilityNote
          ? req.body?.humanAvailability?.note
          : before.humanAvailability?.note || ""
    )
      .trim()
      .slice(0, 500);
    const entityKind = String(req.body?.entityKind || "").trim().slice(0, 80);
    const entityId = String(req.body?.entityId || "").trim().slice(0, 120);
    const requireTakeoverReason =
      req.body?.handoffPolicy?.requireReasonForTakeover ?? before.handoffPolicy?.requireReasonForTakeover ?? false;

    if (nextMode === "TAKEOVER" && requireTakeoverReason && !note) {
      return res.status(422).json({ message: "A reason is required before takeover mode can be enabled" });
    }

    const handoffPolicy = {
      autoReplyWhenUnavailable:
        req.body?.handoffPolicy?.autoReplyWhenUnavailable ??
        before.handoffPolicy?.autoReplyWhenUnavailable ??
        true,
      autoEscalateCritical:
        req.body?.handoffPolicy?.autoEscalateCritical ??
        before.handoffPolicy?.autoEscalateCritical ??
        true,
      requireReasonForTakeover: Boolean(requireTakeoverReason),
    };

    const now = new Date();
    const nextState = {
      operatingMode: nextMode,
      humanAvailability: {
        status: nextAvailability,
        note,
        updatedAt: now,
        updatedBy: req.user?._id || req.user?.id || null,
      },
      handoffPolicy,
      takeover:
        nextMode === "TAKEOVER"
          ? {
              active: true,
              reason: note,
              entityKind,
              entityId,
              startedAt: before.takeover?.active ? before.takeover?.startedAt || now : now,
              startedBy: before.takeover?.active ? before.takeover?.startedBy || (req.user?._id || req.user?.id || null) : (req.user?._id || req.user?.id || null),
            }
          : {
              active: false,
              reason: nextMode === "ASSIST" ? "" : before.takeover?.reason || "",
              entityKind: nextMode === "ASSIST" ? "" : before.takeover?.entityKind || "",
              entityId: nextMode === "ASSIST" ? "" : before.takeover?.entityId || "",
              startedAt: nextMode === "ASSIST" ? null : before.takeover?.startedAt || null,
              startedBy: nextMode === "ASSIST" ? null : before.takeover?.startedBy || null,
            },
      lastAutoHandledAt: nextMode === "AUTO" ? now : existing.lastAutoHandledAt || null,
      lastHumanHandledAt: nextMode !== "AUTO" ? now : existing.lastHumanHandledAt || null,
    };

    const doc = await UnifiedAssistantWorkspace.findOneAndUpdate(
      { scopeKey },
      {
        $set: {
          hospital: hospitalObjectId,
          ...nextState,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const after = serializeWorkspaceState(doc, hospitalObjectId);
    const modeChanged = before.operatingMode !== after.operatingMode;
    const availabilityChanged = before.humanAvailability?.status !== after.humanAvailability?.status;

    if (modeChanged) {
      await logAudit({
        actorId: req.user?._id || req.user?.id,
        actorRole: req.user?.role,
        action: "UNIFIED_ASSISTANT_MODE_UPDATED",
        resource: "unified_assistant_workspace",
        resourceId: doc?._id,
        hospital: hospitalObjectId || null,
        before: { operatingMode: before.operatingMode },
        after: { operatingMode: after.operatingMode },
        metadata: {
          scopeKey,
          fromMode: before.operatingMode,
          toMode: after.operatingMode,
          note,
          entityKind,
          entityId,
        },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    }

    if (availabilityChanged || note) {
      await logAudit({
        actorId: req.user?._id || req.user?.id,
        actorRole: req.user?.role,
        action: "UNIFIED_ASSISTANT_AVAILABILITY_UPDATED",
        resource: "unified_assistant_workspace",
        resourceId: doc?._id,
        hospital: hospitalObjectId || null,
        before: { humanAvailability: before.humanAvailability },
        after: { humanAvailability: after.humanAvailability },
        metadata: {
          scopeKey,
          fromAvailability: before.humanAvailability?.status || "",
          toAvailability: after.humanAvailability?.status || "",
          note,
          entityKind,
          entityId,
        },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    }

    if (modeChanged || availabilityChanged || note) {
      await logAudit({
        actorId: req.user?._id || req.user?.id,
        actorRole: req.user?.role,
        action: "UNIFIED_ASSISTANT_HANDOFF_LOGGED",
        resource: "unified_assistant_workspace",
        resourceId: doc?._id,
        hospital: hospitalObjectId || null,
        metadata: {
          scopeKey,
          note,
          fromMode: before.operatingMode,
          toMode: after.operatingMode,
          fromAvailability: before.humanAvailability?.status || "",
          toAvailability: after.humanAvailability?.status || "",
          entityKind,
          entityId,
        },
        ip: req.ip,
        userAgent: req.get?.("user-agent"),
      });
    }

    return res.json({
      settings: after,
      handoffLogs: await listWorkspaceAuditLogs(hospitalObjectId, 20),
    });
  } catch (err) {
    return next(err);
  }
}

async function createUnifiedAssistantHandoffLog(req, res, next) {
  try {
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);
    const scopeKey = workspaceScopeKey(hospitalObjectId);
    const workspace = await getWorkspaceStateDoc(hospitalObjectId);
    const note = String(req.body?.note || "").trim().slice(0, 500);
    if (!note) {
      return res.status(422).json({ message: "Handoff note is required" });
    }

    const entityKind = String(req.body?.entityKind || "").trim().slice(0, 80);
    const entityId = String(req.body?.entityId || "").trim().slice(0, 120);

    await logAudit({
      actorId: req.user?._id || req.user?.id,
      actorRole: req.user?.role,
      action: "UNIFIED_ASSISTANT_HANDOFF_LOGGED",
      resource: "unified_assistant_workspace",
      resourceId: workspace?._id,
      hospital: hospitalObjectId || null,
      metadata: {
        scopeKey,
        note,
        fromMode: req.body?.fromMode || workspace?.operatingMode || "ASSIST",
        toMode: req.body?.toMode || workspace?.operatingMode || "ASSIST",
        fromAvailability: req.body?.fromAvailability || workspace?.humanAvailability?.status || "AVAILABLE",
        toAvailability: req.body?.toAvailability || workspace?.humanAvailability?.status || "AVAILABLE",
        entityKind,
        entityId,
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.status(201).json({
      ok: true,
      handoffLogs: await listWorkspaceAuditLogs(hospitalObjectId, 20),
    });
  } catch (err) {
    return next(err);
  }
}

async function searchUnifiedAssistant(req, res, next) {
  try {
    const q = String(req.query?.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit || 5), 1), 12);
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);

    if (q.length < 2) {
      return res.json({ items: [] });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const exactId = Types.ObjectId.isValid(q) ? new Types.ObjectId(q) : null;

    const patientFilter = {
      ...hospitalScopeFilter("hospital", hospitalObjectId),
      active: true,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { nationalId: regex },
        { countryId: regex },
        { contact: regex },
        ...(exactId ? [{ _id: exactId }] : []),
      ],
    };

    const hospitalFilter = {
      ...(hospitalObjectId && !canQueryGlobally(req) ? { _id: hospitalObjectId } : {}),
      $or: [
        { name: regex },
        { code: regex },
        { contact: regex },
        { "verification.registrationNumber": regex },
        ...(exactId ? [{ _id: exactId }] : []),
      ],
    };

    const claimFilter = {
      ...hospitalScopeFilter("hospital", hospitalObjectId),
      $or: [
        { "patientSnapshot.nationalId": regex },
        { "hospitalSnapshot.registrationNumber": regex },
        { "provider.code": regex },
        { "procedures.code": regex },
        { "procedures.name": regex },
        ...(exactId ? [{ _id: exactId }] : []),
      ],
    };

    const ticketFilter = {
      ...hospitalScopeFilter("hospital", hospitalObjectId),
      $or: [
        { ticketKey: regex },
        { title: regex },
        { description: regex },
        ...(exactId ? [{ _id: exactId }] : []),
      ],
    };

    const userFilter = {
      ...(hospitalObjectId && !canQueryGlobally(req) ? { hospital: hospitalObjectId } : {}),
      role: { $ne: "GUEST" },
      active: true,
      $or: [
        { name: regex },
        { email: regex },
        { phone: regex },
        { nationalIdNumber: regex },
        ...(exactId ? [{ _id: exactId }] : []),
      ],
    };

    const [patients, hospitals, claims, tickets, users] = await Promise.all([
      Patient.find(patientFilter)
        .select("firstName lastName nationalId countryId hospital identityVerification.status")
        .populate("hospital", "name code")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      Hospital.find(hospitalFilter)
        .select("name code verification.status verification.registrationNumber location.country location.region active")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      Claim.find(claimFilter)
        .select("status riskScore totalAmount currency patientSnapshot hospitalSnapshot createdAt hospital patient")
        .populate("hospital", "name code")
        .populate("patient", "firstName lastName nationalId")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      SupportTicket.find(ticketFilter)
        .select("ticketKey title status priority category hospital updatedAt")
        .populate("hospital", "name code")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      User.find(userFilter)
        .select("name email phone role hospital")
        .populate("hospital", "name code")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const items = [
      ...patients.map((patient) => ({
        kind: "patient",
        id: patient._id,
        title: patientName(patient),
        subtitle: `${patient.hospital?.name || "Hospital"} • ${patient.identityVerification?.status || "UNVERIFIED"}`,
        badges: [patient.nationalId || patient.countryId, patient.hospital?.code].filter(Boolean),
      })),
      ...hospitals.map((hospital) => ({
        kind: "hospital",
        id: hospital._id,
        title: hospital.name || "Hospital",
        subtitle: `${hospital.code || "No code"} • ${hospital.verification?.status || "UNVERIFIED"}`,
        badges: [hospital.location?.country, hospital.location?.region].filter(Boolean),
      })),
      ...claims.map((claim) => ({
        kind: "claim",
        id: claim._id,
        title: `${claim.hospital?.name || claim.hospitalSnapshot?.name || "Hospital"} claim`,
        subtitle: `${patientName(claim.patient)} • ${claim.status}`,
        badges: [claim.currency ? `${claim.currency} ${Number(claim.totalAmount || 0).toLocaleString()}` : null, `Risk ${Math.round(claim.riskScore || 0)}`].filter(Boolean),
      })),
      ...tickets.map((ticket) => ({
        kind: "ticket",
        id: ticket._id,
        title: ticket.title || ticket.ticketKey,
        subtitle: `${ticket.ticketKey} • ${ticket.status}`,
        badges: [ticket.priority, ticket.hospital?.name].filter(Boolean),
      })),
      ...users.map((user) => ({
        kind: "user",
        id: user._id,
        title: userName(user),
        subtitle: `${user.role || "USER"} • ${user.hospital?.name || "Platform"}`,
        badges: [user.email, user.phone].filter(Boolean),
      })),
    ].slice(0, limit * 5);

    return res.json({ items });
  } catch (err) {
    return next(err);
  }
}

async function getUnifiedAssistantRecord(req, res, next) {
  try {
    const { kind, id } = req.params;
    const hospitalId = resolveHospitalScope(req);
    const hospitalObjectId = toObjectId(hospitalId);

    const assertScope = (docHospitalId) => {
      if (!hospitalObjectId || canQueryGlobally(req)) return true;
      return String(docHospitalId || "") === String(hospitalObjectId);
    };

    if (kind === "patient") {
      const patient = await Patient.findById(id)
        .populate("hospital", "name code verification.status contact")
        .populate("primaryDoctor", "name role email phone")
        .lean();
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      if (!assertScope(patient.hospital?._id || patient.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      const [claims, calls, appointments] = await Promise.all([
        Claim.find({ patient: patient._id })
          .select("status riskScore totalAmount currency riskFlags createdAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        CallSession.find({ patient: patient._id, deletedAt: { $exists: false } })
          .populate("doctor", "name role")
          .populate("appointment", "serviceType scheduledAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        Appointment.find({ patient: patient._id })
          .populate("doctor", "name role")
          .sort({ scheduledAt: -1 })
          .limit(8)
          .lean(),
      ]);
      return res.json({ kind, record: patient, related: { claims, calls, appointments } });
    }

    if (kind === "hospital") {
      const hospital = await Hospital.findById(id)
        .select("name code type contact address verification location features insuranceProviders")
        .lean();
      if (!hospital) return res.status(404).json({ message: "Hospital not found" });
      if (!assertScope(hospital._id)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      const [claimSummary, tickets, calls, staffCount, patientCount] = await Promise.all([
        Claim.aggregate([
          { $match: { hospital: hospital._id } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ["$totalAmount", 0] } },
            },
          },
        ]),
        SupportTicket.find({ hospital: hospital._id })
          .select("ticketKey title status priority updatedAt")
          .sort({ updatedAt: -1 })
          .limit(8)
          .lean(),
        CallSession.find({ hospital: hospital._id, deletedAt: { $exists: false } })
          .populate("patient", "firstName lastName nationalId")
          .populate("doctor", "name role")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        User.countDocuments({ hospital: hospital._id, active: true }),
        Patient.countDocuments({ hospital: hospital._id, active: true }),
      ]);
      return res.json({ kind, record: hospital, related: { claimSummary, tickets, calls, staffCount, patientCount } });
    }

    if (kind === "claim") {
      const claim = await Claim.findById(id)
        .populate("hospital", "name code verification.status")
        .populate("patient", "firstName lastName nationalId")
        .populate("submittedBy", "name role email")
        .populate("decision.reviewedBy", "name role")
        .lean();
      if (!claim) return res.status(404).json({ message: "Claim not found" });
      if (!assertScope(claim.hospital?._id || claim.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      const audit = await AuditLog.find({ resourceId: claim._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      return res.json({ kind, record: claim, related: { audit } });
    }

    if (kind === "ticket") {
      const ticket = await SupportTicket.findById(id)
        .populate("hospital", "name code")
        .populate("requester", "name email role")
        .populate("assignee", "name email role")
        .populate("linkedIncident", "incidentKey severity status summary")
        .populate("events.actor", "name role")
        .lean();
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!assertScope(ticket.hospital?._id || ticket.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      return res.json({ kind, record: ticket, related: {} });
    }

    if (kind === "call") {
      const call = await CallSession.findById(id)
        .populate("patient", "firstName lastName nationalId")
        .populate("doctor", "name role email")
        .populate("hospital", "name code")
        .populate("appointment", "serviceType scheduledAt status notes metadata")
        .lean();
      if (!call) return res.status(404).json({ message: "Call not found" });
      if (!assertScope(call.hospital?._id || call.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      return res.json({ kind, record: call, related: {} });
    }

    if (kind === "user") {
      const user = await User.findById(id)
        .select("name email phone role hospital nationalIdNumber employment")
        .populate("hospital", "name code")
        .lean();
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!assertScope(user.hospital?._id || user.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      const [tickets, calls] = await Promise.all([
        SupportTicket.find({ $or: [{ requester: user._id }, { assignee: user._id }] })
          .select("ticketKey title status priority updatedAt")
          .sort({ updatedAt: -1 })
          .limit(8)
          .lean(),
        CallSession.find({ doctor: user._id, deletedAt: { $exists: false } })
          .populate("patient", "firstName lastName nationalId")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);
      return res.json({ kind, record: user, related: { tickets, calls } });
    }

    if (kind === "audit") {
      const audit = await AuditLog.findById(id).populate("actorId", "name role email").lean();
      if (!audit) return res.status(404).json({ message: "Audit log not found" });
      if (!assertScope(audit.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      return res.json({ kind, record: audit, related: {} });
    }

    if (kind === "invoice") {
      const invoice = await Invoice.findById(id)
        .populate("patient", "name email phone")
        .populate("hospital", "name code")
        .lean();
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (!assertScope(invoice.hospital?._id || invoice.hospital)) {
        return res.status(403).json({ message: "Forbidden hospital scope" });
      }
      return res.json({ kind, record: invoice, related: {} });
    }

    return res.status(400).json({ message: "Unsupported record kind" });
  } catch (err) {
    return next(err);
  }
}

export {
  buildOverview as getUnifiedAssistantOverview,
  getUnifiedAssistantSettings,
  updateUnifiedAssistantSettings,
  createUnifiedAssistantHandoffLog,
  searchUnifiedAssistant,
  getUnifiedAssistantRecord,
};
