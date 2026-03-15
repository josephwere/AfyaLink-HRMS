import crypto from "crypto";
import ClaimAuditLog from "../models/ClaimAuditLog.js";

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function appendClaimAudit({ claimId, event, payload, actorId }) {
  const latest = await ClaimAuditLog.findOne({ claim: claimId })
    .sort({ sequence: -1 })
    .lean();

  const prevHash = latest?.hash || "";
  const sequence = latest?.sequence ? latest.sequence + 1 : 1;
  const body = JSON.stringify({
    claimId: String(claimId),
    event,
    payload,
    prevHash,
    sequence,
    ts: new Date().toISOString(),
  });

  const hash = sha256(body);

  return ClaimAuditLog.create({
    claim: claimId,
    actor: actorId || null,
    event,
    payload,
    prevHash,
    hash,
    sequence,
  });
}
