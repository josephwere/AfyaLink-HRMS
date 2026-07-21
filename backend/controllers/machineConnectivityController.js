import Audit from "../models/Audit.js";
import Hospital from "../models/Hospital.js";
import LabOrder from "../models/LabOrder.js";
import MachineDevice from "../models/MachineDevice.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import crypto from "crypto";
import { buildMachineKey, hashMachineKey } from "../middleware/machineAuthMiddleware.js";
import { parseHL7Patient, parseHL7ToSegments } from "../services/hl7Parser.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { signProvenance, verifyProvenance } from "../utils/provenance.js";
import { notify, notifyUsers } from "../services/notificationService.js";

function resolveHospital(req) {
  const role = normalizeRole(req.user?.role);
  const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  if (privileged) return req.query?.hospitalId || req.body?.hospitalId || req.user?.hospital || null;
  return req.user?.hospital || null;
}

const HEARTBEAT_TIMEOUT_MINUTES = Number(process.env.MACHINE_HEARTBEAT_TIMEOUT_MINUTES || 10);
const AUTO_ESCALATE_HIGH_MINUTES = Number(process.env.MACHINE_ALERT_AUTO_ESCALATE_HIGH_MINUTES || 15);
const AUTO_ESCALATE_MEDIUM_MINUTES = Number(process.env.MACHINE_ALERT_AUTO_ESCALATE_MEDIUM_MINUTES || 60);
const ALERT_DEDUP_COOLDOWN_MINUTES = Number(process.env.MACHINE_ALERT_DEDUP_COOLDOWN_MINUTES || 10);
const DEFAULT_L1_ROLES = ["HOSPITAL_ADMIN", "DEVELOPER"];
const DEFAULT_L2_ROLES = ["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"];

async function getMachineAlertPolicy(hospitalId) {
  const fallback = {
    highAfterMinutes: AUTO_ESCALATE_HIGH_MINUTES,
    mediumAfterMinutes: AUTO_ESCALATE_MEDIUM_MINUTES,
    dedupCooldownMinutes: ALERT_DEDUP_COOLDOWN_MINUTES,
    l1Roles: DEFAULT_L1_ROLES,
    l2Roles: DEFAULT_L2_ROLES,
    onCallPrimaryUserIds: [],
    onCallSecondaryUserIds: [],
    requireReasonForHighSeverityActions: false,
  };
  if (!hospitalId) return fallback;
  const hospital = await Hospital.findById(hospitalId).select("customization.machineAlerts").lean();
  const conf = hospital?.customization?.machineAlerts || {};
  return {
    highAfterMinutes: Number.isFinite(Number(conf.autoEscalationHighMinutes))
      ? Number(conf.autoEscalationHighMinutes)
      : fallback.highAfterMinutes,
    mediumAfterMinutes: Number.isFinite(Number(conf.autoEscalationMediumMinutes))
      ? Number(conf.autoEscalationMediumMinutes)
      : fallback.mediumAfterMinutes,
    dedupCooldownMinutes: Number.isFinite(Number(conf.dedupCooldownMinutes))
      ? Number(conf.dedupCooldownMinutes)
      : fallback.dedupCooldownMinutes,
    l1Roles: Array.isArray(conf.l1Roles) && conf.l1Roles.length ? conf.l1Roles : fallback.l1Roles,
    l2Roles: Array.isArray(conf.l2Roles) && conf.l2Roles.length ? conf.l2Roles : fallback.l2Roles,
    onCallPrimaryUserIds: Array.isArray(conf.onCallPrimaryUserIds)
      ? conf.onCallPrimaryUserIds.map((v) => String(v))
      : fallback.onCallPrimaryUserIds,
    onCallSecondaryUserIds: Array.isArray(conf.onCallSecondaryUserIds)
      ? conf.onCallSecondaryUserIds.map((v) => String(v))
      : fallback.onCallSecondaryUserIds,
    requireReasonForHighSeverityActions: Boolean(
      conf.requireReasonForHighSeverityActions ?? fallback.requireReasonForHighSeverityActions
    ),
  };
}

async function audit(req, action, details = {}) {
  try {
    await Audit.create({
      actor: req.user?._id || null,
      action,
      target: "MachineDevice",
      details,
      ip: req.ip,
    });
  } catch (_e) {}
}

async function pushMachineNotification({
  hospital,
  title,
  body,
  category = "INTEGRATION",
  meta = {},
  dedupKey = "",
  dedupCooldownMinutes = ALERT_DEDUP_COOLDOWN_MINUTES,
}) {
  if (!hospital) return;
  try {
    const cooldown = Number(dedupCooldownMinutes || 0);
    const normalizedDedupKey = String(dedupKey || meta?.dedupKey || "").trim();
    if (normalizedDedupKey && cooldown > 0) {
      const since = new Date(Date.now() - cooldown * 60 * 1000);
      const existing = await Notification.findOne({
        hospital,
        category,
        read: false,
        "meta.dedupKey": normalizedDedupKey,
        createdAt: { $gte: since },
      }).lean();
      if (existing) return;
    }
    await notify({
      title,
      body,
      hospital,
      category,
      read: false,
      meta: {
        ...(meta || {}),
        ...(normalizedDedupKey ? { dedupKey: normalizedDedupKey } : {}),
      },
    });
  } catch (_e) {}
}

async function escalateMachineAlertInternal(source, hospital, req, mode = "MANUAL", policy = null) {
  const severity = deriveSeverity(source);
  const level = severity === "HIGH" ? "L2" : "L1";
  const configuredRoles = level === "L2" ? policy?.l2Roles : policy?.l1Roles;
  const onCallUserIds = (level === "L2" ? policy?.onCallSecondaryUserIds : policy?.onCallPrimaryUserIds) || [];
  const roleSet = (Array.isArray(configuredRoles) && configuredRoles.length
    ? configuredRoles
    : level === "L2"
    ? DEFAULT_L2_ROLES
    : DEFAULT_L1_ROLES
  )
    .map((r) => String(r || "").toUpperCase())
    .filter(Boolean);

  const onCallUsers = onCallUserIds.length
    ? await User.find({
        _id: { $in: onCallUserIds.map((id) => String(id)) },
        active: true,
        hospital,
      })
        .select("_id")
        .lean()
    : [];

  const globalRoles = roleSet.filter((r) => ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(r));
  const scopedRoles = roleSet.filter((r) => !["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(r));
  const roleRecipients =
    scopedRoles.length || globalRoles.length
      ? await User.find({
          active: true,
          $or: [
            ...(scopedRoles.length ? [{ role: { $in: scopedRoles }, hospital }] : []),
            ...(globalRoles.length ? [{ role: { $in: globalRoles } }] : []),
          ],
        })
          .select("_id")
          .lean()
      : [];

  const recipientSet = new Set([
    ...onCallUsers.map((u) => String(u._id)),
    ...roleRecipients.map((u) => String(u._id)),
  ]);
  const recipients = Array.from(recipientSet).map((id) => ({ _id: id }));

  const reasonText = String(req?.body?.reason || "").trim();
  const docs = recipients.map((u) => ({
    title: `Escalated machine alert: ${source.title || "Machine issue"}`,
    body: source.body || "Machine integration issue escalated for urgent review.",
    category: "SECURITY",
    user: u._id,
    hospital,
    read: false,
      meta: {
        escalatedFromAlertId: String(source._id),
        machineId: source?.meta?.machineId || null,
        machineCode: source?.meta?.code || null,
        reason: source?.meta?.reason || null,
        severity,
        escalationMode: mode,
        escalationLevel: level,
        escalationRoles: roleSet,
        escalationOnCallUsed: onCallUsers.length > 0,
        escalationReason: reasonText || null,
      },
    }));

  if (docs.length) {
    await notifyUsers({
      users: recipients.map((u) => u._id),
      hospital,
      title: `Escalated machine alert: ${source.title || "Machine issue"}`,
      body: source.body || "Machine integration issue escalated for urgent review.",
      category: "SECURITY",
      read: false,
      meta: {
        escalatedFromAlertId: String(source._id),
        machineId: source?.meta?.machineId || null,
        machineCode: source?.meta?.code || null,
        reason: source?.meta?.reason || null,
        severity,
        escalationMode: mode,
        escalationLevel: level,
        escalationRoles: roleSet,
        escalationOnCallUsed: onCallUsers.length > 0,
        escalationReason: reasonText || null,
      },
    });
  }
  await Notification.updateOne(
    { _id: source._id },
    { $set: { "meta.escalated": true, "meta.autoEscalatedAt": new Date() } }
  );
  if (req) {
    await audit(req, "machine.alert.escalate", {
      alertId: String(source._id),
      recipients: docs.length,
      mode,
      level,
      roles: roleSet,
      reason: reasonText || null,
    });
  }
  return docs.length;
}

async function buildMachineAlertTimeline(hospital, alertId) {
  const source = await Notification.findOne({
    _id: alertId,
    hospital,
    category: "INTEGRATION",
  }).lean();
  if (!source) return null;

  const [escalations, audits] = await Promise.all([
    Notification.find({ hospital, "meta.escalatedFromAlertId": alertId })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    Audit.find({ "details.alertId": alertId })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
  ]);

  const events = [
    {
      type: "ALERT_CREATED",
      createdAt: source.createdAt,
      message: source.title || "Machine alert created",
      details: source,
    },
    ...escalations.map((e) => ({
      type: "ESCALATION_NOTIFICATION",
      createdAt: e.createdAt,
      message: e.title || "Escalation notification created",
      details: e,
    })),
    ...audits.map((a) => ({
      type: "AUDIT",
      createdAt: a.createdAt,
      message: a.action || "Audit event",
      details: a,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return { source, escalations, audits, events };
}

function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function buildEvidenceManifestPayload({ timeline, alertId, hospital }) {
  const payload = {
    alertId,
    hospital: String(hospital),
    generatedAt: new Date().toISOString(),
    sourceAlertId: String(timeline.source?._id || alertId),
    severity: deriveSeverity(timeline.source || {}),
    counts: {
      events: (timeline.events || []).length,
      audits: (timeline.audits || []).length,
      escalations: (timeline.escalations || []).length,
    },
    hashes: {
      sourceAlertSha256: crypto.createHash("sha256").update(JSON.stringify(timeline.source || {})).digest("hex"),
      eventsSha256: crypto.createHash("sha256").update(JSON.stringify(timeline.events || [])).digest("hex"),
      auditsSha256: crypto.createHash("sha256").update(JSON.stringify(timeline.audits || [])).digest("hex"),
      escalationsSha256: crypto
        .createHash("sha256")
        .update(JSON.stringify(timeline.escalations || []))
        .digest("hex"),
    },
  };
  payload.hashes.bundleSha256 = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload.hashes))
    .digest("hex");
  return payload;
}

function deriveSeverity(n) {
  const base = String(n?.meta?.severity || "").toUpperCase();
  if (base) return base;
  const hay = `${String(n?.title || "")} ${String(n?.body || "")} ${String(n?.meta?.reason || "")}`.toLowerCase();
  if (hay.includes("failed") || hay.includes("error")) return "HIGH";
  if (hay.includes("heartbeat") || hay.includes("offline") || hay.includes("timeout")) return "MEDIUM";
  return "LOW";
}

function enforceReasonPolicyForHighSeverity(policy, items, reason, actionName = "action") {
  if (!policy?.requireReasonForHighSeverityActions) return;
  const hasHigh = (items || []).some((item) => deriveSeverity(item) === "HIGH");
  if (!hasHigh) return;
  if (!String(reason || "").trim()) {
    const err = new Error(`Reason is required for high severity ${actionName}.`);
    err.statusCode = 400;
    throw err;
  }
}

async function enforceHeartbeatTimeouts(hospital) {
  const policy = await getMachineAlertPolicy(hospital);
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000);
  const stale = await MachineDevice.find({
    hospital,
    active: true,
    status: "ONLINE",
    $or: [{ lastHeartbeatAt: { $lt: cutoff } }, { lastHeartbeatAt: null }],
  });

  for (const device of stale) {
    device.status = "OFFLINE";
    const shouldAlert =
      !device.lastOfflineAlertAt ||
      Date.now() - new Date(device.lastOfflineAlertAt).getTime() > HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000;
    device.lastOfflineAlertAt = new Date();
    await device.save();
    if (shouldAlert) {
      await pushMachineNotification({
        hospital,
        title: `Machine heartbeat missed: ${device.code}`,
        body: `${device.name} did not send heartbeat in ${HEARTBEAT_TIMEOUT_MINUTES} minutes and was auto-marked OFFLINE.`,
        dedupKey: `machine:${device.code}:heartbeat-timeout`,
        dedupCooldownMinutes: policy.dedupCooldownMinutes,
        meta: { machineId: String(device._id), code: device.code, reason: "HEARTBEAT_TIMEOUT" },
      });
    }
  }
}

async function enforceMachineAlertAutoEscalation(hospital, policy) {
  const highAfterMinutes = Number(policy?.highAfterMinutes ?? AUTO_ESCALATE_HIGH_MINUTES);
  const mediumAfterMinutes = Number(policy?.mediumAfterMinutes ?? AUTO_ESCALATE_MEDIUM_MINUTES);
  const minThreshold = Math.min(
    highAfterMinutes > 0 ? highAfterMinutes : Number.MAX_SAFE_INTEGER,
    mediumAfterMinutes > 0 ? mediumAfterMinutes : Number.MAX_SAFE_INTEGER
  );
  if (!Number.isFinite(minThreshold)) return;

  const now = Date.now();
  const candidates = await Notification.find({
    hospital,
    category: "INTEGRATION",
    read: false,
    "meta.escalated": { $ne: true },
    createdAt: { $lte: new Date(now - minThreshold * 60 * 1000) },
    $or: [
      { title: { $regex: /machine/i } },
      { body: { $regex: /machine|heartbeat|offline|ingest/i } },
      { "meta.reason": "HEARTBEAT_TIMEOUT" },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  for (const alert of candidates) {
    const severity = deriveSeverity(alert);
    const ageMinutes = Math.floor((now - new Date(alert.createdAt).getTime()) / (60 * 1000));
    const shouldEscalate =
      (severity === "HIGH" && highAfterMinutes > 0 && ageMinutes >= highAfterMinutes) ||
      (severity === "MEDIUM" && mediumAfterMinutes > 0 && ageMinutes >= mediumAfterMinutes);
    if (!shouldEscalate) continue;
    await escalateMachineAlertInternal(alert, hospital, null, "AUTO", policy);
  }
}

export async function listMachineDevices(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    await enforceHeartbeatTimeouts(hospital);
    const items = await MachineDevice.find({ hospital }).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function listMachineAlerts(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const policy = await getMachineAlertPolicy(hospital);
    await enforceMachineAlertAutoEscalation(hospital, policy);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const read = req.query.read;
    const severity = String(req.query.severity || "ALL").toUpperCase();

    const filter = {
      hospital,
      category: "INTEGRATION",
      $or: [
        { title: { $regex: /machine/i } },
        { body: { $regex: /machine|heartbeat|offline|ingest/i } },
        { "meta.reason": "HEARTBEAT_TIMEOUT" },
      ],
    };
    if (read === "true") filter.read = true;
    if (read === "false") filter.read = false;

    const [rows, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    const items = rows
      .map((n) => ({ ...n, severity: deriveSeverity(n) }))
      .filter((n) => severity === "ALL" || n.severity === severity);

    return res.json({
      items,
      total,
      page,
      limit,
      autoEscalation: {
        highAfterMinutes: policy.highAfterMinutes,
        mediumAfterMinutes: policy.mediumAfterMinutes,
        dedupCooldownMinutes: policy.dedupCooldownMinutes,
        l1Roles: policy.l1Roles,
        l2Roles: policy.l2Roles,
        onCallPrimaryUserIds: policy.onCallPrimaryUserIds,
        onCallSecondaryUserIds: policy.onCallSecondaryUserIds,
        requireReasonForHighSeverityActions: policy.requireReasonForHighSeverityActions,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeMachineAlert(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const reason = String(req.body?.reason || "").trim();
    const policy = await getMachineAlertPolicy(hospital);
    const source = await Notification.findOne({
      _id: req.params.id,
      hospital,
      category: "INTEGRATION",
    })
      .select("_id title body meta")
      .lean();
    if (!source) return res.status(404).json({ message: "Machine alert not found" });
    enforceReasonPolicyForHighSeverity(policy, [source], reason, "acknowledgement");
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, hospital, category: "INTEGRATION" },
      {
        $set: {
          read: true,
          "meta.ackReason": reason || null,
          "meta.ackedAt": new Date(),
          "meta.ackedBy": req.user?._id || null,
        },
      },
      { new: true }
    );
    await audit(req, "machine.alert.ack", {
      alertId: String(item._id),
      machineId: item?.meta?.machineId || null,
      reason: reason || null,
    });
    return res.json({ item });
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
}

export async function bulkAcknowledgeMachineAlerts(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const policy = await getMachineAlertPolicy(hospital);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean).map(String) : [];
    const severity = String(req.body?.severity || "ALL").toUpperCase();
    const reason = String(req.body?.reason || "").trim();

    const baseFilter = {
      hospital,
      category: "INTEGRATION",
      read: false,
      $or: [
        { title: { $regex: /machine/i } },
        { body: { $regex: /machine|heartbeat|offline|ingest/i } },
        { "meta.reason": "HEARTBEAT_TIMEOUT" },
      ],
    };

    if (ids.length) {
      baseFilter._id = { $in: ids };
    } else if (severity !== "ALL") {
      const rows = await Notification.find(baseFilter).select("_id title body meta").lean();
      baseFilter._id = { $in: rows.filter((r) => deriveSeverity(r) === severity).map((r) => r._id) };
    }
    const candidateRows = await Notification.find(baseFilter).select("_id title body meta").lean();
    enforceReasonPolicyForHighSeverity(policy, candidateRows, reason, "bulk acknowledgement");

    const result = await Notification.updateMany(baseFilter, {
      $set: {
        read: true,
        "meta.ackReason": reason || null,
        "meta.ackedAt": new Date(),
        "meta.ackedBy": req.user?._id || null,
      },
    });
    await audit(req, "machine.alert.bulk_ack", {
      severity,
      explicitIds: ids.length,
      matched: Number(result?.matchedCount || 0),
      modified: Number(result?.modifiedCount || 0),
      reason: reason || null,
    });

    return res.json({
      ok: true,
      matched: Number(result?.matchedCount || 0),
      modified: Number(result?.modifiedCount || 0),
    });
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
}

export async function getMachineAlertPolicyConfig(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const policy = await getMachineAlertPolicy(hospital);
    return res.json({ policy });
  } catch (err) {
    next(err);
  }
}

export async function updateMachineAlertPolicyConfig(req, res, next) {
  try {
    const hospitalId = resolveHospital(req);
    if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });
    const currentPolicy = await getMachineAlertPolicy(hospitalId);

    const high = Number(req.body?.highAfterMinutes ?? currentPolicy.highAfterMinutes);
    const medium = Number(req.body?.mediumAfterMinutes ?? currentPolicy.mediumAfterMinutes);
    const dedupCooldownMinutes = Number(req.body?.dedupCooldownMinutes ?? currentPolicy.dedupCooldownMinutes);
    const requireReasonForHighSeverityActions =
      req.body?.requireReasonForHighSeverityActions === undefined
        ? Boolean(currentPolicy.requireReasonForHighSeverityActions)
        : Boolean(req.body?.requireReasonForHighSeverityActions);
    const normalizeRoleList = (value, fallback) => {
      if (!Array.isArray(value)) return fallback;
      const rows = value
        .map((r) => String(r || "").trim().toUpperCase())
        .filter(Boolean);
      return rows.length ? Array.from(new Set(rows)) : fallback;
    };
    const l1Roles = normalizeRoleList(req.body?.l1Roles, currentPolicy.l1Roles || DEFAULT_L1_ROLES);
    const l2Roles = normalizeRoleList(req.body?.l2Roles, currentPolicy.l2Roles || DEFAULT_L2_ROLES);
    const normalizeIdList = (value, fallback) => {
      if (!Array.isArray(value)) return (fallback || []).map((v) => String(v));
      return Array.from(
        new Set(
          value
            .map((v) => String(v || "").trim())
            .filter(Boolean)
        )
      );
    };
    const onCallPrimaryUserIds = normalizeIdList(
      req.body?.onCallPrimaryUserIds,
      currentPolicy.onCallPrimaryUserIds || []
    );
    const onCallSecondaryUserIds = normalizeIdList(
      req.body?.onCallSecondaryUserIds,
      currentPolicy.onCallSecondaryUserIds || []
    );

    if (!Number.isFinite(high) || !Number.isFinite(medium) || !Number.isFinite(dedupCooldownMinutes)) {
      return res
        .status(400)
        .json({ message: "highAfterMinutes, mediumAfterMinutes and dedupCooldownMinutes must be numbers" });
    }
    if (high < 0 || medium < 0 || high > 10080 || medium > 10080 || dedupCooldownMinutes < 0 || dedupCooldownMinutes > 1440) {
      return res
        .status(400)
        .json({ message: "Escalation thresholds must be 0-10080 minutes; dedup cooldown must be 0-1440 minutes" });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    const customization = hospital.customization?.toObject?.() || hospital.customization || {};
    hospital.customization = {
      ...customization,
      machineAlerts: {
        ...(customization.machineAlerts || {}),
        autoEscalationHighMinutes: Math.floor(high),
        autoEscalationMediumMinutes: Math.floor(medium),
        dedupCooldownMinutes: Math.floor(dedupCooldownMinutes),
        l1Roles,
        l2Roles,
        onCallPrimaryUserIds,
        onCallSecondaryUserIds,
        requireReasonForHighSeverityActions,
      },
      updatedBy: req.user?._id || customization.updatedBy,
      updatedAt: new Date(),
    };
    await hospital.save();
    await audit(req, "machine.alert.policy.update", {
      hospitalId: String(hospital._id),
      highAfterMinutes: Math.floor(high),
      mediumAfterMinutes: Math.floor(medium),
      dedupCooldownMinutes: Math.floor(dedupCooldownMinutes),
      l1Roles,
      l2Roles,
      onCallPrimaryUserIds,
      onCallSecondaryUserIds,
      requireReasonForHighSeverityActions,
    });
    return res.json({
      ok: true,
      policy: {
        highAfterMinutes: Math.floor(high),
        mediumAfterMinutes: Math.floor(medium),
        dedupCooldownMinutes: Math.floor(dedupCooldownMinutes),
        l1Roles,
        l2Roles,
        onCallPrimaryUserIds,
        onCallSecondaryUserIds,
        requireReasonForHighSeverityActions,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function escalateMachineAlert(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const reason = String(req.body?.reason || "").trim();
    const source = await Notification.findOne({ _id: req.params.id, hospital, category: "INTEGRATION" }).lean();
    if (!source) return res.status(404).json({ message: "Machine alert not found" });
    const policy = await getMachineAlertPolicy(hospital);
    enforceReasonPolicyForHighSeverity(policy, [source], reason, "escalation");
    const recipients = await escalateMachineAlertInternal(source, hospital, req, "MANUAL", policy);
    return res.json({ ok: true, recipients });
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ message: err.message });
    next(err);
  }
}

export async function getMachineAlertTimeline(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const alertId = String(req.params.id || "");
    const timeline = await buildMachineAlertTimeline(hospital, alertId);
    if (!timeline) return res.status(404).json({ message: "Machine alert not found" });

    return res.json({
      alert: timeline.source,
      escalations: timeline.escalations,
      audits: timeline.audits,
      events: timeline.events,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportMachineAlertTimelineCsv(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const alertId = String(req.params.id || "");
    const timeline = await buildMachineAlertTimeline(hospital, alertId);
    if (!timeline) return res.status(404).json({ message: "Machine alert not found" });

    const header = ["time", "type", "message", "action", "details"];
    const rows = timeline.events.map((ev) => [
      ev.createdAt ? new Date(ev.createdAt).toISOString() : "",
      ev.type || "",
      ev.message || "",
      ev.details?.action || "",
      JSON.stringify(ev.details || {}),
    ]);
    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="machine-alert-${alertId}-timeline.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

export async function exportMachineAlertTimelinePdf(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const alertId = String(req.params.id || "");
    const timeline = await buildMachineAlertTimeline(hospital, alertId);
    if (!timeline) return res.status(404).json({ message: "Machine alert not found" });

    const { default: PDFDocument } = await import("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"machine-alert-${alertId}-timeline.pdf\"`
    );
    doc.pipe(res);

    const source = timeline.source || {};
    doc.fontSize(16).text("AfyaLink Machine Alert Timeline", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Alert ID: ${alertId}`);
    doc.text(`Generated At: ${new Date().toISOString()}`);
    doc.text(`Hospital: ${String(hospital)}`);
    doc.text(`Severity: ${deriveSeverity(source)}`);
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Title: ${source.title || "-"}`);
    doc.text(`Body: ${source.body || "-"}`);
    doc.moveDown(0.8);

    doc.fontSize(12).text("Events", { underline: true });
    doc.moveDown(0.3);
    timeline.events.forEach((ev, idx) => {
      const line = `${idx + 1}. [${ev.type}] ${ev.createdAt ? new Date(ev.createdAt).toISOString() : "-"} - ${
        ev.message || "-"
      }`;
      doc.fontSize(10).text(line, { width: 520 });
      doc.moveDown(0.2);
    });

    const digest = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          alert: timeline.source,
          events: timeline.events,
          audits: timeline.audits,
          escalations: timeline.escalations,
        })
      )
      .digest("hex");
    const sig = signProvenance(
      {
        alertId,
        hospital: String(hospital),
        digest,
        eventCount: (timeline.events || []).length,
      },
      { channel: "machine-alert-timeline-pdf" }
    );

    doc.moveDown(0.8);
    doc.fontSize(10).text(`Evidence SHA-256: ${digest}`);
    doc.text(`Signature (${sig.algorithm}): ${sig.signature}`);
    doc.text(`Signed At: ${sig.signedAt}`);
    doc.end();
  } catch (err) {
    next(err);
  }
}

export async function getMachineAlertEvidenceManifest(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const alertId = String(req.params.id || "");
    const timeline = await buildMachineAlertTimeline(hospital, alertId);
    if (!timeline) return res.status(404).json({ message: "Machine alert not found" });

    const payload = buildEvidenceManifestPayload({ timeline, alertId, hospital });

    const signature = signProvenance(payload, {
      channel: "machine-alert-evidence-manifest",
      actorId: req.user?._id ? String(req.user._id) : null,
      role: req.user?.role || null,
    });

    return res.json({
      payload,
      signature,
      download: {
        csv: `/api/machine-connectivity/alerts/${alertId}/timeline.csv`,
        pdf: `/api/machine-connectivity/alerts/${alertId}/timeline.pdf`,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function exportMachineAlertEvidenceBundle(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const alertId = String(req.params.id || "");
    const timeline = await buildMachineAlertTimeline(hospital, alertId);
    if (!timeline) return res.status(404).json({ message: "Machine alert not found" });

    const payload = buildEvidenceManifestPayload({ timeline, alertId, hospital });
    const signature = signProvenance(payload, {
      channel: "machine-alert-evidence-bundle",
      actorId: req.user?._id ? String(req.user._id) : null,
      role: req.user?.role || null,
    });

    const bundle = {
      kind: "AFYALINK_MACHINE_ALERT_EVIDENCE_BUNDLE",
      version: "1.0",
      generatedAt: new Date().toISOString(),
      payload,
      signature,
      timeline: {
        source: timeline.source,
        events: timeline.events,
        audits: timeline.audits,
        escalations: timeline.escalations,
      },
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"machine-alert-${alertId}-evidence-bundle.json\"`
    );
    return res.status(200).send(JSON.stringify(bundle, null, 2));
  } catch (err) {
    next(err);
  }
}

export async function verifyMachineAlertEvidenceManifest(req, res, next) {
  try {
    const payload = req.body?.payload || null;
    const signature =
      req.body?.signature?.signature ||
      req.body?.signature ||
      req.body?.provenanceSignature ||
      null;
    if (!payload || !signature) {
      return res.status(400).json({ message: "payload and signature are required" });
    }
    const verification = verifyProvenance(payload, signature);
    return res.json({
      ok: Boolean(verification.valid),
      verification,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function machineConnectivityOverview(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    await enforceHeartbeatTimeouts(hospital);

    const devices = await MachineDevice.find({ hospital, active: true }).select("_id status protocol machineType").lean();
    const machineIds = devices.map((d) => String(d._id));
    const total = devices.length;
    const online = devices.filter((d) => d.status === "ONLINE").length;
    const offline = devices.filter((d) => d.status === "OFFLINE").length;
    const error = devices.filter((d) => d.status === "ERROR").length;
    const maintenance = devices.filter((d) => d.status === "MAINTENANCE").length;
    const uptimePercent = total ? Number(((online / total) * 100).toFixed(2)) : 0;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ingestionSuccess24h = await Audit.countDocuments({
      action: "machine.lab_result.ingest",
      "details.machineId": { $in: machineIds },
      createdAt: { $gte: since24h },
    });
    const ingestionFail24h = await Audit.countDocuments({
      action: "machine.lab_result.ingest_failed",
      "details.machineId": { $in: machineIds },
      createdAt: { $gte: since24h },
    });
    const heartbeat24h = await Audit.countDocuments({
      action: "machine.heartbeat",
      "details.machineId": { $in: machineIds },
      createdAt: { $gte: since24h },
    });

    return res.json({
      total,
      online,
      offline,
      error,
      maintenance,
      uptimePercent,
      heartbeatTimeoutMinutes: HEARTBEAT_TIMEOUT_MINUTES,
      ingestionSuccess24h,
      ingestionFail24h,
      heartbeat24h,
    });
  } catch (err) {
    next(err);
  }
}

export async function listMachineAudit(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);
    const machineId = req.query.machineId ? String(req.query.machineId) : "";
    const action = req.query.action ? String(req.query.action) : "";
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const hospitalMachineIds = await MachineDevice.find({ hospital }).distinct("_id");
    const hospitalMachineIdStrings = hospitalMachineIds.map((id) => String(id));

    const filter = {
      action: { $regex: /^machine\./ },
      "details.machineId": { $in: hospitalMachineIdStrings },
    };
    if (machineId) {
      filter["details.machineId"] = machineId;
    }
    if (action && action !== "ALL") {
      filter.action = action;
    }
    if (from || to) {
      filter.createdAt = {};
      if (from && !Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      if (to && !Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
    }

    const [items, total] = await Promise.all([
      Audit.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Audit.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function createMachineDevice(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const machineKey = buildMachineKey();
    const body = req.body || {};
    const device = await MachineDevice.create({
      hospital,
      branch: body.branch || null,
      name: String(body.name || "").trim(),
      code: String(body.code || "").trim().toUpperCase(),
      department: String(body.department || "").trim(),
      machineType: body.machineType || "OTHER",
      protocol: body.protocol || "REST",
      apiKeyHash: hashMachineKey(machineKey),
      metadata: body.metadata || {},
      capabilities: body.capabilities || {},
      active: body.active !== false,
      status: "OFFLINE",
    });

    await audit(req, "machine.register", { machineId: device._id, code: device.code, protocol: device.protocol });
    return res.status(201).json({
      device,
      machineKey,
      note: "Store this machine key securely; it is only returned once.",
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMachineDevice(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });
    const body = req.body || {};
    const update = {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.department !== undefined ? { department: String(body.department).trim() } : {}),
      ...(body.machineType !== undefined ? { machineType: body.machineType } : {}),
      ...(body.protocol !== undefined ? { protocol: body.protocol } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
      ...(body.capabilities !== undefined ? { capabilities: body.capabilities } : {}),
      ...(body.branch !== undefined ? { branch: body.branch || null } : {}),
    };

    const device = await MachineDevice.findOneAndUpdate(
      { _id: req.params.id, hospital },
      { $set: update },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: "Machine device not found" });

    await audit(req, "machine.update", { machineId: device._id, update });
    if (["OFFLINE", "ERROR", "MAINTENANCE"].includes(String(device.status))) {
      const policy = await getMachineAlertPolicy(hospital);
      await pushMachineNotification({
        hospital,
        title: `Machine ${device.code} status changed`,
        body: `${device.name} is now ${device.status}. Verify machine health/integration channel.`,
        dedupKey: `machine:${device.code}:status:${device.status}`,
        dedupCooldownMinutes: policy.dedupCooldownMinutes,
        meta: { machineId: String(device._id), code: device.code, status: device.status },
      });
    }
    return res.json({ device });
  } catch (err) {
    next(err);
  }
}

export async function rotateMachineDeviceKey(req, res, next) {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const machineKey = buildMachineKey();
    const device = await MachineDevice.findOneAndUpdate(
      { _id: req.params.id, hospital },
      { $set: { apiKeyHash: hashMachineKey(machineKey) } },
      { new: true }
    );
    if (!device) return res.status(404).json({ message: "Machine device not found" });

    await audit(req, "machine.rotate_key", { machineId: device._id, code: device.code });
    return res.json({
      device,
      machineKey,
      note: "Old key invalidated. Store the new machine key securely.",
    });
  } catch (err) {
    next(err);
  }
}

export async function machineHeartbeat(req, res, next) {
  try {
    const device = req.machine;
    device.lastHeartbeatAt = new Date();
    device.lastSeenIp = req.ip || "";
    if (device.status !== "MAINTENANCE") {
      device.status = "ONLINE";
    }
    await device.save();

    await Audit.create({
      actor: null,
      action: "machine.heartbeat",
      target: "MachineDevice",
      details: { machineId: device._id, code: device.code, status: device.status },
      ip: req.ip,
    });

    return res.json({
      ok: true,
      machineId: device._id,
      status: device.status,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function ingestLabMachineResult(req, res, next) {
  try {
    const device = req.machine;
    if (!device.capabilities?.ingestLabResults) {
      return res.status(403).json({ message: "Machine is not allowed to ingest lab results" });
    }

    const {
      labOrderId,
      result,
      resultStatus,
      externalResultId,
      testName,
      patientId,
    } = req.body || {};

    if (!labOrderId || !result) {
      return res.status(400).json({ message: "labOrderId and result are required" });
    }

    const lab = await LabOrder.findOne({ _id: labOrderId, hospital: device.hospital });
    if (!lab) return res.status(404).json({ message: "Lab order not found in machine hospital scope" });
    if (testName && String(lab.testName || "").trim() !== String(testName).trim()) {
      return res.status(400).json({ message: "testName mismatch for provided lab order" });
    }
    if (patientId && String(lab.patient) !== String(patientId)) {
      return res.status(400).json({ message: "patient mismatch for provided lab order" });
    }

    lab.result = typeof result === "string" ? result : JSON.stringify(result);
    lab.status = String(resultStatus || "").toLowerCase() === "cancelled" ? "Cancelled" : "Completed";
    lab.completedAt = new Date();
    lab.set("metadata", {
      ...(lab.metadata || {}),
      machine: {
        machineId: device._id,
        machineCode: device.code,
        machineName: device.name,
        protocol: device.protocol,
        externalResultId: externalResultId || null,
      },
    });
    await lab.save();

    device.lastHeartbeatAt = new Date();
    device.lastSeenIp = req.ip || "";
    if (device.status !== "MAINTENANCE") device.status = "ONLINE";
    await device.save();

    await Audit.create({
      actor: null,
      action: "machine.lab_result.ingest",
      target: "LabOrder",
      details: {
        labOrderId: String(lab._id),
        machineId: String(device._id),
        externalResultId: externalResultId || null,
      },
      ip: req.ip,
    });

    return res.json({
      ok: true,
      labOrderId: lab._id,
      status: lab.status,
      completedAt: lab.completedAt,
    });
  } catch (err) {
    if (req.machine?._id) {
      try {
        await Audit.create({
          actor: null,
          action: "machine.lab_result.ingest_failed",
          target: "LabOrder",
          details: {
            machineId: String(req.machine._id),
            code: req.machine.code,
            error: err?.message || "ingest_failed",
          },
          ip: req.ip,
        });
      } catch (_e) {}
    }
    if (req.machine?.hospital) {
      const policy = await getMachineAlertPolicy(req.machine.hospital);
      await pushMachineNotification({
        hospital: req.machine.hospital,
        title: "Machine lab ingestion failed",
        body: err?.message || "Machine lab ingestion failed",
        dedupKey: `machine:${req.machine?.code || "unknown"}:ingest-failed`,
        dedupCooldownMinutes: policy.dedupCooldownMinutes,
        meta: {
          machineId: req.machine?._id ? String(req.machine._id) : null,
          code: req.machine?.code || null,
        },
      });
    }
    next(err);
  }
}

export async function testHl7Parse(req, res, next) {
  try {
    const raw = String(req.body?.hl7 || "").trim();
    if (!raw) return res.status(400).json({ message: "hl7 payload is required" });
    const patient = parseHL7Patient(raw);
    const segments = parseHL7ToSegments(raw);
    return res.json({
      ok: true,
      patient,
      segmentsPreview: segments.slice(0, 12),
    });
  } catch (err) {
    return res.status(400).json({ message: err?.message || "HL7 parse failed" });
  }
}

export async function testDicomStub(req, res, next) {
  try {
    const studyUid =
      String(req.body?.studyUid || "").trim() ||
      `1.2.840.113619.${Date.now()}.${Math.floor(Math.random() * 100000)}`;
    const modality = String(req.body?.modality || "CT").trim().toUpperCase();
    const patientId = String(req.body?.patientId || "").trim() || "UNKNOWN";
    const accessionNumber = String(req.body?.accessionNumber || "").trim() || `ACC-${Date.now()}`;
    return res.json({
      ok: true,
      dicom: {
        association: "accepted",
        aet: String(req.body?.aet || "AFYALINK-PACS"),
        studyUid,
        modality,
        patientId,
        accessionNumber,
        status: "STORED",
        receivedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}
