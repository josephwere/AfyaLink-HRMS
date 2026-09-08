import crypto from "crypto";

export class ConsolidationSignatureService {
  static computeSignatureHash({ runId, eventType, actor, role, approverId = null, comment = "", timestamp = new Date(), details = {} } = {}) {
    const payload = {
      runId,
      eventType,
      actor,
      role,
      approverId,
      comment,
      timestamp: timestamp.toISOString(),
      details,
    };
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
}

export default ConsolidationSignatureService;
