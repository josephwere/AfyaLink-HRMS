import { createHash, randomUUID } from "crypto";
import mongoose from "mongoose";
import { neuroedgeGatewayClient, NeuroEdgeGatewayError } from "../services/neuroedgeGatewayClient.js";
import { logAudit } from "../services/auditService.js";
import { redis } from "../utils/redis.js";
import AIGatewayJob from "../models/AIGatewayJob.js";
import AIGatewayProvenance from "../models/AIGatewayProvenance.js";
import AIGatewayDecision from "../models/AIGatewayDecision.js";
import AIGatewayIdempotencyLedger from "../models/AIGatewayIdempotencyLedger.js";
import { getGatewayMetricsSnapshot, recordGatewayMetric } from "../services/aiGatewayMetrics.js";

const ASYNC_ENDPOINTS = new Set(["extract", "ingest", "simulate/digital-twin"]);

const CONSENT_SCOPE_FIELDS = {
  demographics: ["patient", "person", "name", "gender", "dob", "birthDate", "identifier", "address", "phone"],
  encounters: ["encounter", "visit", "admission", "discharge", "diagnosis", "notes", "task"],
  labs: ["lab", "labs", "observation", "result", "results", "test", "tests"],
  prescriptions: ["prescription", "prescriptions", "medication", "medications", "drug", "drugs"],
  billing: ["billing", "invoice", "invoices", "payment", "payments"],
  insurance: ["insurance", "payer", "policy"],
  documents: ["document", "documents", "attachment", "attachments"],
};

const SENSITIVE_PATTERNS = [/patient/i, /name/i, /dob/i, /birth/i, /phone/i, /email/i, /address/i, /identifier/i, /mrn/i, /national/i, /insurance/i];

function getCorrelationId(req) {
  return (
    req.headers["x-correlation-id"] ||
    req.headers["x-request-id"] ||
    req.traceId ||
    `corr_${Date.now()}_${randomUUID().slice(0, 8)}`
  );
}

function setTraceHeaders(res, correlationId, idempotencyKey = null) {
  res.setHeader("X-Correlation-Id", correlationId);
  if (idempotencyKey) res.setHeader("Idempotency-Key", String(idempotencyKey));
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  return scopes
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
}

function hashPayload(payload) {
  try {
    return createHash("sha256").update(JSON.stringify(payload || {})).digest("hex");
  } catch {
    return null;
  }
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function resolveTenant(req, body) {
  return (
    body?.tenantId ||
    req.user?.tenantId ||
    req.user?.hospital ||
    req.user?.hospitalId ||
    "afyalink-default"
  );
}

function resolveHospital(req, body) {
  return body?.hospitalId || req.user?.hospital || req.user?.hospitalId || null;
}

function toHospitalRef(hospitalId) {
  if (!hospitalId) return null;
  const raw = String(hospitalId);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function isPlatformRole(role) {
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(String(role || ""));
}

function enforceHospitalScope(req, bodyHospitalId) {
  const userHospital = String(req.user?.hospital || req.user?.hospitalId || "");
  const requested = String(bodyHospitalId || "");
  if (!requested || !userHospital) return true;
  if (requested === userHospital) return true;
  return isPlatformRole(req.user?.role);
}

function resolveActor(req) {
  return {
    userId: String(req.user?._id || ""),
    role: String(req.user?.role || ""),
    departmentId: req.user?.department || null,
    sourceIp: req.ip,
    deviceId: req.headers["x-device-id"] || null,
  };
}

function consentAllowsField(scopes, key) {
  const allowedScopeList = normalizeScopes(scopes);
  if (!allowedScopeList.length) return false;
  const k = String(key || "").toLowerCase();
  for (const scope of allowedScopeList) {
    const fields = CONSENT_SCOPE_FIELDS[scope] || [];
    if (fields.some((f) => k.includes(String(f).toLowerCase()))) return true;
  }
  return false;
}

function sanitizeTransformPayload(payload, scopes) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const allowedScopeList = normalizeScopes(scopes);
  if (!allowedScopeList.length) return null;
  const allowedKeys = new Set();
  for (const scope of allowedScopeList) {
    for (const key of CONSENT_SCOPE_FIELDS[scope] || []) {
      allowedKeys.add(key.toLowerCase());
    }
  }

  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (allowedKeys.has(String(k).toLowerCase())) {
      out[k] = v;
    }
  }
  if (!Object.keys(out).length) return null;
  return out;
}

function maskSensitiveFields(value, consentScopes, prefix = "") {
  if (Array.isArray(value)) {
    return value.map((item, idx) => maskSensitiveFields(item, consentScopes, `${prefix}[${idx}]`));
  }
  if (!isPlainObject(value)) return value;

  const out = {};
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const sensitive = SENSITIVE_PATTERNS.some((re) => re.test(key));
    if (sensitive && !consentAllowsField(consentScopes, key)) {
      out[key] = "***REDACTED***";
      continue;
    }
    out[key] = maskSensitiveFields(v, consentScopes, path);
  }
  return out;
}

function validateRequest(endpointName, payload) {
  const errors = [];
  const ensure = (cond, message) => {
    if (!cond) errors.push(message);
  };

  ensure(typeof payload?.tenantId === "string" && payload.tenantId.trim(), "tenantId is required");
  ensure(payload?.hospitalId, "hospitalId is required");
  ensure(isPlainObject(payload?.actor), "actor is required");
  ensure(typeof payload?.actor?.userId === "string" && payload.actor.userId.trim(), "actor.userId is required");
  ensure(typeof payload?.actor?.role === "string" && payload.actor.role.trim(), "actor.role is required");

  switch (endpointName) {
    case "extract":
      ensure(isPlainObject(payload?.source), "source is required");
      ensure(typeof payload?.source?.uri === "string" && payload.source.uri.trim(), "source.uri is required");
      ensure(
        typeof payload?.source?.mimeType === "string" && payload.source.mimeType.trim(),
        "source.mimeType is required"
      );
      break;
    case "ingest":
      ensure(isPlainObject(payload?.document), "document is required");
      ensure(typeof payload?.document?.uri === "string" && payload.document.uri.trim(), "document.uri is required");
      ensure(typeof payload?.document?.type === "string" && payload.document.type.trim(), "document.type is required");
      break;
    case "search":
      ensure(typeof payload?.query === "string" && payload.query.trim(), "query is required");
      break;
    case "fhir-transform":
      ensure(typeof payload?.resourceType === "string" && payload.resourceType.trim(), "resourceType is required");
      ensure(isPlainObject(payload?.payload), "payload object is required");
      break;
    case "hl7-transform":
      ensure(typeof payload?.messageType === "string" && payload.messageType.trim(), "messageType is required");
      ensure(isPlainObject(payload?.payload), "payload object is required");
      break;
    case "risk/staffing-forecast":
      ensure(Number.isInteger(payload?.horizonDays), "horizonDays (integer) is required");
      break;
    case "risk/burnout-score":
      ensure(payload?.hospitalId || payload?.tenantId, "hospitalId or tenantId is required");
      break;
    case "risk/causal-impact":
      ensure(isPlainObject(payload?.policyChange), "policyChange object is required");
      break;
    case "simulate/digital-twin":
      ensure(isPlainObject(payload?.scenario), "scenario object is required");
      break;
    default:
      break;
  }
  return errors;
}

function extractProvenance(response) {
  const pv = response?.provenance || response?.signature || null;
  if (!pv) return null;
  return {
    model: pv.model || null,
    modelVersion: pv.modelVersion || null,
    promptHash: pv.promptHash || null,
    evidenceIds: Array.isArray(pv.evidenceIds) ? pv.evidenceIds : [],
    generatedAt: pv.generatedAt || null,
    signature: pv.signature || response?.signature || null,
    keyId: pv.keyId || null,
  };
}

async function writeAudit(req, { action, resource, resourceId, after, success = true, error = null }) {
  await logAudit({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    action,
    resource,
    resourceId,
    hospital: req.user?.hospital || req.user?.hospitalId || null,
    ip: req.ip,
    userAgent: req.get?.("user-agent"),
    success,
    error,
    after: {
      correlationId: after?.correlationId || getCorrelationId(req),
      ...after,
    },
  });
}

function getBodyIdempotencyKey(req) {
  return req.body?.idempotencyKey || req.headers["idempotency-key"] || null;
}

function getIdempotencyCacheKey(req, endpointName, idempotencyKey) {
  const actor = String(req.user?._id || "anon");
  return `ai:gateway:idem:${endpointName}:${actor}:${idempotencyKey}`;
}

async function getCachedResponse(cacheKey) {
  if (!cacheKey) return null;
  try {
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    if (typeof cached === "string") {
      return JSON.parse(cached);
    }
    return cached;
  } catch {
    return null;
  }
}

async function cacheResponse(cacheKey, value) {
  if (!cacheKey) return;
  try {
    await redis.set(cacheKey, JSON.stringify(value), { ex: 60 * 30 });
  } catch {
    // best effort
  }
}

async function getIdempotencyLedgerHit({ endpointName, req, idempotencyKey, requestHash }) {
  if (!idempotencyKey) return null;
  const tenantId = resolveTenant(req, req.body);
  const hospitalId = resolveHospital(req, req.body);
  const hospitalRef = toHospitalRef(hospitalId);

  const doc = await AIGatewayIdempotencyLedger.findOne({
    endpoint: endpointName,
    actorId: req.user?._id,
    tenantId,
    hospital: hospitalRef,
    idempotencyKey: String(idempotencyKey),
    requestHash,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!doc) return null;
  return {
    status: doc.responseStatus,
    body: doc.responseBody,
  };
}

async function saveIdempotencyLedger({ endpointName, req, idempotencyKey, requestHash, correlationId, status, body }) {
  if (!idempotencyKey) {
    return { status, body, stored: false };
  }
  const tenantId = resolveTenant(req, req.body);
  const hospitalId = resolveHospital(req, req.body);
  const hospitalRef = toHospitalRef(hospitalId);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const query = {
    endpoint: endpointName,
    actorId: req.user?._id,
    tenantId,
    hospital: hospitalRef,
    idempotencyKey: String(idempotencyKey),
  };
  try {
    const doc = await AIGatewayIdempotencyLedger.findOneAndUpdate(
      query,
      {
        $set: {
          requestHash,
          correlationId,
          responseStatus: status,
          responseBody: body,
          expiresAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      status: doc?.responseStatus ?? status,
      body: doc?.responseBody ?? body,
      stored: true,
      conflict: false,
    };
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const existing = await AIGatewayIdempotencyLedger.findOne(query).lean();
    if (!existing) throw err;
    return {
      status: existing.responseStatus,
      body: existing.responseBody,
      stored: false,
      conflict: true,
    };
  }
}

async function persistDecision({ req, endpointName, correlationId, tenantId, hospitalId, action, resource, decisionResp }) {
  const hospitalRef = toHospitalRef(hospitalId);
  const d = await AIGatewayDecision.create({
    correlationId,
    endpoint: endpointName,
    action,
    resource,
    actorId: req.user?._id,
    actorRole: req.user?.role || null,
    tenantId,
    hospital: hospitalRef,
    decision: decisionResp?.allow ? "ALLOW" : "DENY",
    reason: decisionResp?.reason || null,
    obligations: Array.isArray(decisionResp?.obligations) ? decisionResp.obligations : [],
    maskedFields: Array.isArray(decisionResp?.maskedFields) ? decisionResp.maskedFields : [],
    policy: decisionResp || null,
  });
  return d;
}

async function persistJobAndProvenance({
  req,
  endpointName,
  correlationId,
  idempotencyKey,
  payloadHash,
  tenantId,
  hospitalId,
  response = null,
  error = null,
  latencyMs = null,
  localJobId = null,
  baseJob = null,
}) {
  const hospitalRef = toHospitalRef(hospitalId);
  const provenance = extractProvenance(response);
  const docData = {
    localJobId,
    endpoint: endpointName,
    correlationId,
    idempotencyKey: idempotencyKey || null,
    requestHash: payloadHash || null,
    actorId: req.user?._id,
    actorRole: req.user?.role || null,
    tenantId: tenantId || null,
    hospital: hospitalRef,
    neuroedgeJobId: response?.jobId || null,
    status: response?.status || (error ? "FAILED" : "SUCCEEDED"),
    outcome: error ? "FAILED" : "SUCCESS",
    errorCode: error?.code || null,
    errorMessage: error?.message || null,
    latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
    provenance: provenance || null,
    responseSummary: {
      status: response?.status || null,
      hasData: Boolean(response && typeof response === "object"),
      result: response?.result ?? response?.data ?? null,
    },
  };

  let doc;
  if (baseJob?._id) {
    doc = await AIGatewayJob.findByIdAndUpdate(baseJob._id, { $set: docData }, { new: true });
  } else if (docData.neuroedgeJobId) {
    doc = await AIGatewayJob.findOneAndUpdate(
      { neuroedgeJobId: docData.neuroedgeJobId },
      { $set: docData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    doc = await AIGatewayJob.create(docData);
  }

  if (provenance) {
    await AIGatewayProvenance.create({
      jobRef: doc?._id || null,
      correlationId,
      endpoint: endpointName,
      tenantId,
      hospital: hospitalRef,
      model: provenance.model || null,
      modelVersion: provenance.modelVersion || null,
      promptHash: provenance.promptHash || null,
      evidenceIds: provenance.evidenceIds || [],
      generatedAt: provenance.generatedAt ? new Date(provenance.generatedAt) : null,
      signature: provenance.signature || null,
      keyId: provenance.keyId || null,
      raw: provenance,
    });
  }

  return doc;
}

async function authorizeWithNeuroEdge({ req, endpointName, payload, correlationId, tenantId, hospitalId, action = "invoke" }) {
  const actor = payload.actor;
  const resource = {
    domain: "ai_gateway",
    type: endpointName,
    id: payload?.resourceId || null,
    attributes: {
      endpoint: endpointName,
      hospitalId: hospitalId ? String(hospitalId) : null,
      tenantId,
    },
  };

  const decisionResp = await neuroedgeGatewayClient.authorize(
    {
      tenantId,
      hospitalId: hospitalId ? String(hospitalId) : undefined,
      actor,
      action,
      resource,
      consent: payload?.consent || null,
      context: {
        role: req.user?.role,
        route: req.originalUrl,
        method: req.method,
      },
    },
    { correlationId }
  );

  await persistDecision({ req, endpointName, correlationId, tenantId, hospitalId, action, resource, decisionResp });

  if (!decisionResp?.allow) {
    const err = new NeuroEdgeGatewayError(decisionResp?.reason || "Policy denied", {
      status: 403,
      code: "AI_POLICY_DENIED",
      details: {
        obligations: decisionResp?.obligations || [],
        maskedFields: decisionResp?.maskedFields || [],
      },
    });
    throw err;
  }

  return decisionResp;
}

async function processAsyncJob({ req, endpointName, auditAction, payload, correlationId, idempotencyKey, payloadHash, baseJob, clientCall, consentScopes }) {
  const startedAt = Date.now();
  const tenantId = payload.tenantId;
  const hospitalId = payload.hospitalId;

  const lock = await AIGatewayJob.findOneAndUpdate(
    { _id: baseJob._id, status: "QUEUED" },
    { $set: { status: "RUNNING", outcome: "SUCCESS", errorCode: null, errorMessage: null } },
    { new: true }
  );
  if (!lock) return;

  try {
    const response = await clientCall(payload, { correlationId, idempotencyKey });
    const latencyMs = Date.now() - startedAt;
    const maskedResponse = maskSensitiveFields(response, consentScopes);

    const finalDoc = await persistJobAndProvenance({
      req,
      endpointName,
      correlationId,
      idempotencyKey,
      payloadHash,
      tenantId,
      hospitalId,
      response: maskedResponse,
      latencyMs,
      localJobId: baseJob.localJobId,
      baseJob,
    });

    recordGatewayMetric({
      endpoint: endpointName,
      success: true,
      latencyMs,
      retryCount: Number(response?.meta?.retryCount || 0),
      costUnits: Number(response?.meta?.costUnits || response?.usage?.costUnits || 0),
    });

    await writeAudit(req, {
      action: auditAction,
      resource: "ai_gateway",
      resourceId: finalDoc?._id || null,
      after: {
        correlationId,
        endpoint: endpointName,
        idempotencyKey: idempotencyKey || null,
        payloadHash,
        neuroedgeStatus: maskedResponse?.status || null,
        neuroedgeJobId: maskedResponse?.jobId || null,
        tenantId,
        hospitalId,
        decision: "ALLOW",
        localJobId: baseJob.localJobId,
      },
    });
  } catch (err) {
    const mapped = err instanceof NeuroEdgeGatewayError ? err : null;
    const latencyMs = Date.now() - startedAt;

    await persistJobAndProvenance({
      req,
      endpointName,
      correlationId,
      idempotencyKey,
      payloadHash,
      tenantId,
      hospitalId,
      error: mapped || err,
      latencyMs,
      localJobId: baseJob.localJobId,
      baseJob,
    });

    recordGatewayMetric({
      endpoint: endpointName,
      success: false,
      latencyMs,
      retryCount: Number(err?.details?.retryCount || 0),
    });

    await writeAudit(req, {
      action: auditAction,
      resource: "ai_gateway",
      resourceId: baseJob?._id || null,
      success: false,
      error: mapped?.code || err?.message || "AI_GATEWAY_ASYNC_ERROR",
      after: {
        correlationId,
        endpoint: endpointName,
        decision: "DENY",
        localJobId: baseJob.localJobId,
      },
    });
  }
}

async function gatewayCall(req, res, next, options) {
  const startedAt = Date.now();
  const correlationId = getCorrelationId(req);
  const idempotencyKey = getBodyIdempotencyKey(req);
  setTraceHeaders(res, correlationId, idempotencyKey);

  const cacheKey = idempotencyKey
    ? getIdempotencyCacheKey(req, options.endpointName, String(idempotencyKey))
    : null;

  try {
    const tenantId = resolveTenant(req, req.body);
    const hospitalId = resolveHospital(req, req.body);
    if (!enforceHospitalScope(req, hospitalId)) {
      recordGatewayMetric({ endpoint: options.endpointName, success: false, guardrailDenied: true });
      return res.status(403).json({
        ok: false,
        code: "HOSPITAL_SCOPE_DENIED",
        message: "Requested hospital scope is not allowed for current user",
        correlationId,
      });
    }

    const actor = resolveActor(req);
    const consentScopes = normalizeScopes(req.body?.consent?.scopes || []);

    let payload = {
      ...req.body,
      tenantId,
      hospitalId,
      actor,
    };

    if (typeof options.payloadMutator === "function") {
      payload = await options.payloadMutator(payload, req);
      if (!payload) {
        recordGatewayMetric({ endpoint: options.endpointName, success: false, guardrailDenied: true });
        return res.status(403).json({
          ok: false,
          code: "CONSENT_SCOPE_DENIED",
          message: options.scopeErrorMessage || "Payload denied by consent scopes",
          correlationId,
        });
      }
    }

    const validationErrors = validateRequest(options.endpointName, payload);
    if (validationErrors.length) {
      recordGatewayMetric({ endpoint: options.endpointName, success: false, guardrailDenied: true });
      return res.status(422).json({
        ok: false,
        code: "AI_GATEWAY_VALIDATION_ERROR",
        message: "Invalid request payload",
        errors: validationErrors,
        correlationId,
      });
    }

    const payloadHash = hashPayload(payload);

    const ledgerHit = await getIdempotencyLedgerHit({
      endpointName: options.endpointName,
      req,
      idempotencyKey,
      requestHash: payloadHash,
    });
    if (ledgerHit) {
      return res.status(ledgerHit.status).json(ledgerHit.body);
    }

    if (cacheKey) {
      const cached = await getCachedResponse(cacheKey);
      if (cached) return res.json(cached);
    }

    await authorizeWithNeuroEdge({
      req,
      endpointName: options.endpointName,
      payload,
      correlationId,
      tenantId,
      hospitalId,
      action: options.policyAction || "invoke",
    });

    if (ASYNC_ENDPOINTS.has(options.endpointName)) {
      const hospitalRef = toHospitalRef(hospitalId);
      const localJobId = `aigw_${Date.now()}_${randomUUID().slice(0, 8)}`;
      let baseJob;
      if (idempotencyKey) {
        baseJob = await AIGatewayJob.findOneAndUpdate(
          {
            endpoint: options.endpointName,
            actorId: req.user?._id,
            tenantId,
            hospital: hospitalRef,
            idempotencyKey: String(idempotencyKey),
          },
          {
            $setOnInsert: {
              localJobId,
              correlationId,
              requestHash: payloadHash,
              actorRole: req.user?.role || null,
              status: "QUEUED",
              outcome: "SUCCESS",
              responseSummary: { status: "QUEUED", hasData: false },
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        baseJob = await AIGatewayJob.create({
          localJobId,
          endpoint: options.endpointName,
          correlationId,
          idempotencyKey: null,
          requestHash: payloadHash,
          actorId: req.user?._id,
          actorRole: req.user?.role || null,
          tenantId,
          hospital: hospitalRef,
          status: "QUEUED",
          outcome: "SUCCESS",
          responseSummary: { status: "QUEUED", hasData: false },
        });
      }

      const accepted = {
        ok: true,
        correlationId,
        data: {
          jobId: baseJob.localJobId,
          status: "QUEUED",
          async: true,
        },
      };

      const ledgerResult = await saveIdempotencyLedger({
        endpointName: options.endpointName,
        req,
        idempotencyKey,
        requestHash: payloadHash,
        correlationId,
        status: 202,
        body: accepted,
      });
      if (cacheKey) await cacheResponse(cacheKey, ledgerResult.body);

      setImmediate(() => {
        processAsyncJob({
          req,
          endpointName: options.endpointName,
          auditAction: options.auditAction,
          payload,
          correlationId,
          idempotencyKey,
          payloadHash,
          baseJob,
          clientCall: options.clientCall,
          consentScopes,
        }).catch(() => {});
      });

      return res.status(ledgerResult.status).json(ledgerResult.body);
    }

    const response = await options.clientCall(payload, {
      correlationId,
      idempotencyKey,
    });
    const latencyMs = Date.now() - startedAt;
    const maskedResponse = maskSensitiveFields(response, consentScopes);

    const doc = await persistJobAndProvenance({
      req,
      endpointName: options.endpointName,
      correlationId,
      idempotencyKey,
      payloadHash,
      tenantId,
      hospitalId,
      response: maskedResponse,
      latencyMs,
    });

    const envelope = {
      ok: true,
      correlationId,
      data: maskedResponse,
    };

    if (cacheKey) await cacheResponse(cacheKey, envelope);
    const ledgerResult = await saveIdempotencyLedger({
      endpointName: options.endpointName,
      req,
      idempotencyKey,
      requestHash: payloadHash,
      correlationId,
      status: 200,
      body: envelope,
    });
    if (ledgerResult.conflict) {
      return res.status(ledgerResult.status).json(ledgerResult.body);
    }

    recordGatewayMetric({
      endpoint: options.endpointName,
      success: true,
      latencyMs,
      retryCount: Number(response?.meta?.retryCount || 0),
      costUnits: Number(response?.meta?.costUnits || response?.usage?.costUnits || 0),
    });

    await writeAudit(req, {
      action: options.auditAction,
      resource: "ai_gateway",
      resourceId: doc?._id || null,
      after: {
        correlationId,
        endpoint: options.endpointName,
        idempotencyKey: idempotencyKey || null,
        payloadHash,
        neuroedgeStatus: maskedResponse?.status || null,
        neuroedgeJobId: maskedResponse?.jobId || null,
        tenantId,
        hospitalId,
        decision: "ALLOW",
        provenance: extractProvenance(maskedResponse),
      },
    });

    return res.status(200).json(envelope);
  } catch (err) {
    const mapped = err instanceof NeuroEdgeGatewayError ? err : null;
    const latencyMs = Date.now() - startedAt;

    recordGatewayMetric({
      endpoint: options.endpointName,
      success: false,
      latencyMs,
      retryCount: Number(err?.details?.retryCount || 0),
      guardrailDenied: Boolean(mapped?.code === "AI_POLICY_DENIED"),
    });

    await writeAudit(req, {
      action: options.auditAction,
      resource: "ai_gateway",
      success: false,
      error: mapped?.code || err?.message || "AI_GATEWAY_ERROR",
      after: {
        correlationId,
        endpoint: options.endpointName,
        decision: "DENY",
      },
    });

    if (mapped) {
      return res.status(mapped.status || 502).json({
        ok: false,
        code: mapped.code,
        message: mapped.message,
        details: mapped.details || null,
        correlationId,
      });
    }

    return next(err);
  }
}

export const gatewayExtract = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "extract",
    auditAction: "AI_GATEWAY_EXTRACT",
    policyAction: "extract",
    clientCall: neuroedgeGatewayClient.extract,
  });

export const gatewayIngest = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "ingest",
    auditAction: "AI_GATEWAY_INGEST",
    policyAction: "ingest",
    clientCall: neuroedgeGatewayClient.ingestDocument,
  });

export const gatewaySearch = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "search",
    auditAction: "AI_GATEWAY_SEARCH",
    policyAction: "search",
    clientCall: neuroedgeGatewayClient.search,
  });

export const gatewayFhirTransform = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "fhir-transform",
    auditAction: "AI_GATEWAY_FHIR_TRANSFORM",
    policyAction: "transform.fhir",
    clientCall: neuroedgeGatewayClient.fhirTransform,
    scopeErrorMessage: "No allowed FHIR fields for current consent scopes",
    payloadMutator: (payload) => {
      const consentScopes = payload?.consent?.scopes;
      if (!consentScopes) return payload;
      const sanitized = sanitizeTransformPayload(payload.payload, consentScopes);
      if (!sanitized) return null;
      return { ...payload, payload: sanitized };
    },
  });

export const gatewayHl7Transform = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "hl7-transform",
    auditAction: "AI_GATEWAY_HL7_TRANSFORM",
    policyAction: "transform.hl7",
    clientCall: neuroedgeGatewayClient.hl7Transform,
    scopeErrorMessage: "No allowed HL7 fields for current consent scopes",
    payloadMutator: (payload) => {
      const consentScopes = payload?.consent?.scopes;
      if (!consentScopes) return payload;
      const sanitized = sanitizeTransformPayload(payload.payload, consentScopes);
      if (!sanitized) return null;
      return { ...payload, payload: sanitized };
    },
  });

export const gatewayRiskStaffingForecast = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "risk/staffing-forecast",
    auditAction: "AI_GATEWAY_STAFFING_FORECAST",
    policyAction: "risk.staffing_forecast",
    clientCall: neuroedgeGatewayClient.staffingForecast,
  });

export const gatewayRiskBurnoutScore = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "risk/burnout-score",
    auditAction: "AI_GATEWAY_BURNOUT_SCORE",
    policyAction: "risk.burnout_score",
    clientCall: neuroedgeGatewayClient.burnoutScore,
  });

export const gatewayRiskCausalImpact = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "risk/causal-impact",
    auditAction: "AI_GATEWAY_CAUSAL_IMPACT",
    policyAction: "risk.causal_impact",
    clientCall: neuroedgeGatewayClient.causalImpact,
  });

export const gatewayDigitalTwin = (req, res, next) =>
  gatewayCall(req, res, next, {
    endpointName: "simulate/digital-twin",
    auditAction: "AI_GATEWAY_DIGITAL_TWIN",
    policyAction: "simulate.digital_twin",
    clientCall: neuroedgeGatewayClient.digitalTwin,
  });

export const gatewayJobStatus = async (req, res, next) => {
  const correlationId = getCorrelationId(req);
  setTraceHeaders(res, correlationId);
  try {
    const jobRef = String(req.params.jobId || "");
    const local = await AIGatewayJob.findOne({
      $or: [{ localJobId: jobRef }, { neuroedgeJobId: jobRef }],
    }).lean();

    if (local) {
      const result = local.responseSummary?.hasData ? local.responseSummary?.result ?? local.responseSummary : null;
      return res.json({
        ok: true,
        correlationId,
        data: {
          jobId: local.localJobId || local.neuroedgeJobId,
          status: local.status,
          result,
          error:
            local.outcome === "FAILED"
              ? {
                  code: local.errorCode || "AI_GATEWAY_JOB_FAILED",
                  message: local.errorMessage || "Job failed",
                }
              : null,
          provenance: local.provenance || null,
        },
      });
    }

    const data = await neuroedgeGatewayClient.getJob(jobRef, { correlationId });
    return res.json({ ok: true, correlationId, data });
  } catch (err) {
    const mapped = err instanceof NeuroEdgeGatewayError ? err : null;
    if (mapped) {
      return res.status(mapped.status || 502).json({
        ok: false,
        code: mapped.code,
        message: mapped.message,
        details: mapped.details || null,
        correlationId,
      });
    }
    return next(err);
  }
};

export const gatewayHealth = async (req, res, next) => {
  const correlationId = getCorrelationId(req);
  setTraceHeaders(res, correlationId);
  try {
    const upstream = await neuroedgeGatewayClient.health({ correlationId });
    return res.json({
      ok: true,
      correlationId,
      upstream: {
        healthy: true,
        degradedMode: String(upstream?.status || "").toUpperCase() === "DEGRADED",
        response: upstream,
      },
      metrics: getGatewayMetricsSnapshot(),
    });
  } catch (err) {
    const mapped = err instanceof NeuroEdgeGatewayError ? err : null;
    return res.status(mapped?.status || 503).json({
      ok: false,
      code: mapped?.code || "NEUROEDGE_HEALTH_FAILED",
      message: mapped?.message || "NeuroEdge health check failed",
      details: mapped?.details || null,
      correlationId,
      metrics: getGatewayMetricsSnapshot(),
    });
  }
};

export const __aiGatewayInternals = {
  sanitizeTransformPayload,
  validateRequest,
  maskSensitiveFields,
  normalizeScopes,
  getBodyIdempotencyKey,
  getIdempotencyCacheKey,
};
