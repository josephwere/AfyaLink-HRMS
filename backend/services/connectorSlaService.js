import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";
import AuditLog from "../models/AuditLog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const policyPath = path.resolve(__dirname, "..", "config", "connectorSlaPolicies.json");

let policyCache = null;

function loadPolicies() {
  if (policyCache) return policyCache;
  try {
    const raw = fs.readFileSync(policyPath, "utf8");
    policyCache = JSON.parse(raw);
  } catch {
    policyCache = {
      default: {
        p95LatencyMs: 1500,
      },
      profiles: {},
    };
  }
  return policyCache;
}

function getProfile(connectorType = "", operation = "") {
  const policies = loadPolicies();
  const defaultPolicy = policies.default || {};
  const typeKey = String(connectorType || "").toUpperCase();
  const opKey = String(operation || "").toUpperCase();
  const profile =
    policies?.profiles?.[typeKey] ||
    policies?.profiles?.[opKey] ||
    {};
  return { ...defaultPolicy, ...profile };
}

export async function recordConnectorSlaProbe({
  connector,
  operation,
  ok,
  statusCode,
  latencyMs,
  errorMessage = null,
  actor = null,
}) {
  const profile = getProfile(connector?.type, operation);
  const latencyThreshold = Number(profile?.p95LatencyMs || 1500);
  const breachByLatency = Number(latencyMs || 0) > latencyThreshold;
  const breachByError = !ok;
  const breach = breachByLatency || breachByError;

  let breachReason = null;
  if (breachByError) breachReason = `connector_error:${statusCode || "unknown"}`;
  else if (breachByLatency) breachReason = `latency_exceeded:${latencyThreshold}`;

  const event = await ConnectorSlaEvent.create({
    connectorId: connector?._id,
    hospitalId: connector?.hospitalId || null,
    connectorType: connector?.type || "unknown",
    operation,
    statusCode: Number(statusCode || 0),
    latencyMs: Number(latencyMs || 0),
    ok: Boolean(ok),
    breach,
    breachReason,
    meta: {
      connectorName: connector?.name || null,
      thresholdMs: latencyThreshold,
      errorMessage: errorMessage || null,
    },
  });

  if (breach) {
    await Notification.create({
      title: "Connector SLA breach",
      body: `${connector?.name || "Connector"} ${operation} breached SLA (${breachReason})`,
      category: "INTEGRATION",
      hospital: connector?.hospitalId || null,
      read: false,
      meta: {
        connectorId: connector?._id,
        connectorType: connector?.type,
        operation,
        statusCode: Number(statusCode || 0),
        latencyMs: Number(latencyMs || 0),
        thresholdMs: latencyThreshold,
        breachReason,
      },
    });

    await AuditLog.create({
      actorId: actor?._id || null,
      actorRole: actor?.role || null,
      action: "CONNECTOR_SLA_BREACH",
      resource: "connector",
      resourceId: connector?._id || null,
      hospital: connector?.hospitalId || null,
      success: false,
      error: breachReason,
      metadata: {
        operation,
        statusCode: Number(statusCode || 0),
        latencyMs: Number(latencyMs || 0),
        thresholdMs: latencyThreshold,
      },
    });
  }

  return { event, breach, breachReason, thresholdMs: latencyThreshold };
}

