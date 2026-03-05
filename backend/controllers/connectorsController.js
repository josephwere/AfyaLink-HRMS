import Connector from '../models/Connector.js';
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";
import axios from 'axios';
import { decrypt } from '../services/cryptoService.js';
import fhirAdapter from '../services/fhirAdapter.js';
import { recordConnectorSlaProbe } from "../services/connectorSlaService.js";
import ConnectorIngestReceipt from "../models/ConnectorIngestReceipt.js";
import { parseHL7Patient } from "../services/hl7Parser.js";
import { mapFHIRToAfyaPatient } from "../services/fhirAdapter.js";
import { logAudit } from "../services/auditService.js";

function normalizeConnectorType(type = "") {
  return String(type || "").trim().toLowerCase();
}

function normalizeSourceType(sourceType = "", connector = null) {
  const source = String(sourceType || "").trim().toUpperCase();
  if (source) return source;
  const profile = String(connector?.profile || "").toUpperCase();
  if (profile.includes("FHIR")) return "FHIR";
  if (profile.includes("HL7")) return "HL7";
  const type = String(connector?.type || "").toUpperCase();
  if (type === "FHIR") return "FHIR";
  if (type === "HL7") return "HL7";
  return "JSON";
}

function migrationDecision(runtime = {}) {
  const mode = String(runtime?.mode || "SHADOW").toUpperCase();
  const dryRun = runtime?.dryRun !== false;
  const shouldWrite = !dryRun && (mode === "MIRROR" || mode === "CUTOVER");
  return { mode, dryRun, shouldWrite };
}

function sanitizeConnectorInput(body = {}) {
  const type = normalizeConnectorType(body.type || "custom");
  const profile = String(body.profile || "").toUpperCase();
  const safeProfile =
    ["FHIR_R4", "HL7_V2", "DICOM", "REST", "CSV", "CUSTOM"].includes(profile) ? profile : "CUSTOM";

  return {
    ...body,
    type,
    profile: safeProfile,
    capabilities: {
      canPull: Boolean(body?.capabilities?.canPull),
      canPush: body?.capabilities?.canPush !== false,
      supportsWebhook: body?.capabilities?.supportsWebhook !== false,
      supportsBatch: Boolean(body?.capabilities?.supportsBatch),
      supportsRealtime: body?.capabilities?.supportsRealtime !== false,
      supportsDeltaSync: Boolean(body?.capabilities?.supportsDeltaSync),
    },
    runtime: {
      mode: String(body?.runtime?.mode || "SHADOW").toUpperCase(),
      dryRun: body?.runtime?.dryRun !== false,
      lastCursor: String(body?.runtime?.lastCursor || ""),
      migrationProjectId: body?.runtime?.migrationProjectId || undefined,
    },
  };
}

export async function createConnector(req,res){
  const body = sanitizeConnectorInput(req.body || {});
  // already handled in route earlier but keep for completeness
  const c = await Connector.create({
    ...body,
    hospitalId: req.user?.hospitalId || null,
  });
  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.actualRole || req.user?.role,
    action: "CONNECTOR_CREATED",
    resource: "Connector",
    resourceId: c._id,
    hospital: req.user?.hospitalId || null,
    after: { name: c.name, type: c.type, profile: c.profile, mode: c.runtime?.mode },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });
  res.json(c);
}

export async function listConnectors(req,res){
  const isGlobal =
    ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(
      String(req.user?.actualRole || req.user?.role || "").toUpperCase()
    );
  const filter = isGlobal
    ? (req.query?.hospitalId ? { hospitalId: req.query.hospitalId } : {})
    : { hospitalId: req.user?.hospitalId };
  const list = await Connector.find(filter).sort({ createdAt: -1, _id: -1 });
  res.json(list);
}

export async function testRestConnection(req,res){
  const startedAt = Date.now();
  try{
    const { connectorId } = req.params;
    const conn = await Connector.findById(connectorId);
    if(!conn) return res.status(404).json({ error: 'connector not found' });
    // prepare headers
    const headers = {};
    if(conn.authType === 'apikey' && conn.apiKey){
      headers['Authorization'] = 'Bearer ' + decrypt(conn.apiKey);
    } else if(conn.authType === 'basic' && conn.username && conn.password){
      const pw = decrypt(conn.password);
      headers['Authorization'] = 'Basic ' + Buffer.from(conn.username + ':' + pw).toString('base64');
    }
    // call health endpoint
    const r = await axios.get(conn.url + '/health', { headers, timeout: 8000 });
    await recordConnectorSlaProbe({
      connector: conn,
      operation: "REST_HEALTH",
      ok: true,
      statusCode: r.status,
      latencyMs: Date.now() - startedAt,
      actor: req.user,
    });
    res.json({ ok: true, status: r.status, data: r.data });
  }catch(err){
    try {
      const { connectorId } = req.params;
      const conn = await Connector.findById(connectorId);
      if (conn) {
        await recordConnectorSlaProbe({
          connector: conn,
          operation: "REST_HEALTH",
          ok: false,
          statusCode: err?.response?.status || 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: err.message,
          actor: req.user,
        });
      }
    } catch (_) {}
    res.status(400).json({ ok:false, error: err.message, detail: err.response?.data || null });
  }
}

export async function testFHIR(req,res){
  const startedAt = Date.now();
  try{
    const { connectorId } = req.params;
    const conn = await Connector.findById(connectorId);
    if(!conn) return res.status(404).json({ error: 'connector not found' });
    const base = conn.url;
    const out = await fhirAdapter.testFHIRServer(base);
    await recordConnectorSlaProbe({
      connector: conn,
      operation: "FHIR_CAPABILITY",
      ok: true,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      actor: req.user,
    });
    res.json({ ok:true, capability: out });
  }catch(err){
    try {
      const { connectorId } = req.params;
      const conn = await Connector.findById(connectorId);
      if (conn) {
        await recordConnectorSlaProbe({
          connector: conn,
          operation: "FHIR_CAPABILITY",
          ok: false,
          statusCode: err?.response?.status || 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: err.message,
          actor: req.user,
        });
      }
    } catch (_) {}
    res.status(400).json({ ok:false, error: err.message });
  }
}

export async function connectorAnalytics(req,res){
  // basic analytics: lastSync and success/fail counts
  const data = await Connector.aggregate([
    { $match: {} },
    { $project: { name:1, type:1, status:1, lastSync:1 } },
    { $sort: { lastSync: -1 } }
  ]);
  res.json(data);
}

export async function connectorSlaSummary(req, res) {
  try {
    const hospitalId = req.user?.hospitalId || null;
    const windowHours = Math.min(Math.max(Number(req.query.windowHours) || 24, 1), 24 * 14);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const match = { createdAt: { $gte: since } };
    if (hospitalId) match.hospitalId = hospitalId;

    const rows = await ConnectorSlaEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { connectorId: "$connectorId", operation: "$operation" },
          total: { $sum: 1 },
          okTotal: { $sum: { $cond: ["$ok", 1, 0] } },
          breachTotal: { $sum: { $cond: ["$breach", 1, 0] } },
          avgLatencyMs: { $avg: "$latencyMs" },
          maxLatencyMs: { $max: "$latencyMs" },
          lastSeenAt: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          connectorId: "$_id.connectorId",
          operation: "$_id.operation",
          total: 1,
          okTotal: 1,
          breachTotal: 1,
          successRate: {
            $cond: [{ $gt: ["$total", 0] }, { $divide: ["$okTotal", "$total"] }, 0],
          },
          breachRate: {
            $cond: [{ $gt: ["$total", 0] }, { $divide: ["$breachTotal", "$total"] }, 0],
          },
          avgLatencyMs: { $round: ["$avgLatencyMs", 2] },
          maxLatencyMs: 1,
          lastSeenAt: 1,
        },
      },
      { $sort: { breachRate: -1, avgLatencyMs: -1 } },
    ]);

    return res.json({ windowHours, count: rows.length, summary: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load connector SLA summary" });
  }
}

export async function listConnectorSlaEvents(req, res) {
  try {
    const connectorId = req.params.connectorId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const filter = { connectorId };
    if (req.user?.hospitalId) filter.hospitalId = req.user.hospitalId;
    const events = await ConnectorSlaEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ count: events.length, events });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load connector SLA events" });
  }
}

export async function getConnectorSdkManifest(_req, res) {
  return res.json({
    sdkVersion: "2026-03-06",
    auth: {
      webhookSignatureHeaders: ["x-afya-signature", "x-signature"],
      hmacAlgo: "sha256",
      idempotencyHeader: "x-idempotency-key",
      eventIdHeader: "x-event-id",
      cursorHeader: "x-source-cursor",
    },
    migrationModes: ["SHADOW", "MIRROR", "CUTOVER", "ROLLBACK", "PAUSED"],
    sourceTypes: ["FHIR", "HL7", "JSON", "CSV", "CUSTOM"],
    pushEndpoint: "/api/connectors/:connectorId/ingest",
    pullStateEndpoint: "/api/connectors/:connectorId/runtime",
    cursorAckEndpoint: "/api/connectors/:connectorId/runtime/cursor",
    behavior: {
      SHADOW: "accept+validate without write",
      MIRROR: "write side-by-side with source system",
      CUTOVER: "AfyaLink primary write path",
      ROLLBACK: "accept for audit, hold write",
      PAUSED: "reject ingest with 409",
    },
  });
}

export async function getConnectorRuntime(req, res) {
  const connector = await Connector.findById(req.params.connectorId).lean();
  if (!connector) return res.status(404).json({ error: "connector not found" });
  if (
    req.user?.hospitalId &&
    connector.hospitalId &&
    String(connector.hospitalId) !== String(req.user.hospitalId)
  ) {
    return res.status(403).json({ error: "forbidden" });
  }
  return res.json({
    connectorId: connector._id,
    type: connector.type,
    profile: connector.profile || "CUSTOM",
    runtime: connector.runtime || {},
    capabilities: connector.capabilities || {},
    lastSync: connector.lastSync || null,
  });
}

export async function updateConnectorRuntime(req, res) {
  const connector = await Connector.findById(req.params.connectorId);
  if (!connector) return res.status(404).json({ error: "connector not found" });
  if (
    req.user?.hospitalId &&
    connector.hospitalId &&
    String(connector.hospitalId) !== String(req.user.hospitalId)
  ) {
    return res.status(403).json({ error: "forbidden" });
  }
  const mode = String(req.body?.mode || connector.runtime?.mode || "SHADOW").toUpperCase();
  if (!["SHADOW", "MIRROR", "CUTOVER", "ROLLBACK", "PAUSED"].includes(mode)) {
    return res.status(400).json({ error: "invalid mode" });
  }
  connector.runtime = {
    ...(connector.runtime || {}),
    mode,
    dryRun: req.body?.dryRun !== undefined ? Boolean(req.body.dryRun) : connector.runtime?.dryRun !== false,
    migrationProjectId: req.body?.migrationProjectId || connector.runtime?.migrationProjectId || undefined,
  };
  await connector.save();
  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.actualRole || req.user?.role,
    action: "CONNECTOR_RUNTIME_UPDATED",
    resource: "Connector",
    resourceId: connector._id,
    hospital: connector.hospitalId || null,
    after: { mode: connector.runtime?.mode, dryRun: connector.runtime?.dryRun },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });
  return res.json({ ok: true, connector });
}

export async function acknowledgeConnectorCursor(req, res) {
  const connector = await Connector.findById(req.params.connectorId);
  if (!connector) return res.status(404).json({ error: "connector not found" });
  if (
    req.user?.hospitalId &&
    connector.hospitalId &&
    String(connector.hospitalId) !== String(req.user.hospitalId)
  ) {
    return res.status(403).json({ error: "forbidden" });
  }
  const cursor = String(req.body?.cursor || "").trim();
  if (!cursor) return res.status(400).json({ error: "cursor is required" });
  connector.runtime = {
    ...(connector.runtime || {}),
    lastCursor: cursor,
    lastSuccessAt: new Date(),
  };
  connector.lastSync = new Date();
  await connector.save();
  return res.json({ ok: true, connectorId: connector._id, cursor });
}

export async function ingestConnectorPayload(req, res) {
  const connector = await Connector.findById(req.params.connectorId);
  if (!connector) return res.status(404).json({ error: "connector not found" });
  if (
    req.user?.hospitalId &&
    connector.hospitalId &&
    String(connector.hospitalId) !== String(req.user.hospitalId)
  ) {
    return res.status(403).json({ error: "forbidden" });
  }

  const { mode, dryRun, shouldWrite } = migrationDecision(connector.runtime || {});
  if (mode === "PAUSED") {
    return res.status(409).json({ error: "connector paused", mode });
  }

  const idempotencyKey =
    String(
      req.headers["x-idempotency-key"] ||
      req.body?.idempotencyKey ||
      req.body?.eventId ||
      ""
    ).trim();
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotency key is required" });
  }
  const sourceEventId = String(req.headers["x-event-id"] || req.body?.eventId || "").trim();
  const sourceType = normalizeSourceType(req.body?.sourceType, connector);
  const payload = req.body?.payload ?? req.body;

  const existing = await ConnectorIngestReceipt.findOne({
    connectorId: connector._id,
    idempotencyKey,
  }).lean();
  if (existing) {
    return res.json({
      ok: true,
      deduplicated: true,
      receiptId: existing._id,
      status: existing.status,
      mode: existing.modeAtIngest,
      dryRun: existing.dryRun,
    });
  }

  let summary = { sourceType, mode, dryRun };
  let status = "ACCEPTED";
  try {
    if (sourceType === "FHIR" && payload?.resourceType === "Patient") {
      const mapped = mapFHIRToAfyaPatient(payload);
      summary = {
        ...summary,
        resourceType: payload.resourceType,
        mappedFields: Object.keys(mapped || {}).length,
      };
    } else if (sourceType === "HL7" && typeof payload === "string") {
      const mapped = parseHL7Patient(payload);
      summary = {
        ...summary,
        segmentType: "PID",
        mappedFields: Object.keys(mapped || {}).length,
      };
    } else {
      summary = {
        ...summary,
        payloadType: Array.isArray(payload) ? "array" : typeof payload,
      };
    }
    if (shouldWrite) {
      status = "PROCESSED";
    }
  } catch (err) {
    status = "REJECTED";
    summary = {
      ...summary,
      error: err.message,
    };
  }

  const receipt = await ConnectorIngestReceipt.create({
    connectorId: connector._id,
    hospitalId: connector.hospitalId,
    idempotencyKey,
    sourceEventId,
    sourceType,
    modeAtIngest: mode,
    dryRun,
    status,
    summary,
  });

  connector.runtime = {
    ...(connector.runtime || {}),
    lastSuccessAt: status === "REJECTED" ? connector.runtime?.lastSuccessAt || null : new Date(),
    lastErrorAt: status === "REJECTED" ? new Date() : connector.runtime?.lastErrorAt || null,
    lastError: status === "REJECTED" ? String(summary.error || "Ingest rejected") : "",
  };
  connector.lastSync = new Date();
  await connector.save();

  await logAudit({
    actorId: req.user?._id || null,
    actorRole: req.user?.actualRole || req.user?.role || "SYSTEM",
    action: "CONNECTOR_INGEST_ACCEPTED",
    resource: "Connector",
    resourceId: connector._id,
    hospital: connector.hospitalId || null,
    after: {
      idempotencyKey,
      sourceType,
      sourceEventId,
      mode,
      dryRun,
      status,
    },
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
  });

  return res.status(status === "REJECTED" ? 422 : 202).json({
    ok: status !== "REJECTED",
    receiptId: receipt._id,
    status,
    mode,
    dryRun,
    shouldWrite,
    summary,
  });
}

export default {
  createConnector,
  listConnectors,
  testRestConnection,
  testFHIR,
  connectorAnalytics,
  connectorSlaSummary,
  listConnectorSlaEvents,
  getConnectorSdkManifest,
  getConnectorRuntime,
  updateConnectorRuntime,
  acknowledgeConnectorCursor,
  ingestConnectorPayload,
};
