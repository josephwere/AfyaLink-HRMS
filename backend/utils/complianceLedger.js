import crypto from "crypto";
import ComplianceLedger from "../models/ComplianceLedger.js";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function resolveTenantKey({ hospital }) {
  if (!hospital) return "global";
  return `hospital:${String(hospital)}`;
}

export async function appendComplianceLedger({
  actorId,
  actorRole,
  action,
  resource,
  resourceId,
  hospital = null,
  metadata = {},
}) {
  try {
    const tenantKey = resolveTenantKey({ hospital });
    const latest = await ComplianceLedger.findOne({ tenantKey })
      .sort({ chainIndex: -1 })
      .select("chainIndex entryHash")
      .lean();

    const chainIndex = latest ? latest.chainIndex + 1 : 1;
    const prevHash = latest?.entryHash || "";
    const payload = {
      tenantKey,
      chainIndex,
      prevHash,
      action,
      actorId: actorId ? String(actorId) : null,
      actorRole: actorRole || null,
      resource: resource || null,
      resourceId: resourceId ? String(resourceId) : null,
      hospital: hospital ? String(hospital) : null,
      metadata: metadata || {},
      ts: new Date().toISOString(),
    };

    const entryHash = hashPayload(payload);
    return ComplianceLedger.create({
      tenantKey,
      chainIndex,
      prevHash,
      entryHash,
      action,
      actorId,
      actorRole,
      resource,
      resourceId,
      hospital,
      metadata,
    });
  } catch (err) {
    // Ledger should never block runtime actions.
    console.error("COMPLIANCE_LEDGER_APPEND_FAILED:", err.message);
    return null;
  }
}
