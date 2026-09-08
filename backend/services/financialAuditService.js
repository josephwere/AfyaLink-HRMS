import FinancialAuditEvent from "../models/FinancialAuditEvent.js";

export class FinancialAuditService {
  static async recordEvent({ actor, action, entityType, entityId, metadata = {}, correlationId = null, sourceService = "finance" }) {
    return FinancialAuditEvent.create({
      actor,
      action,
      entityType,
      entityId,
      metadata,
      correlationId,
      sourceService,
    });
  }

  static async getAuditTrail({ entityType = null, entityId = null } = {}) {
    const query = {};
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    return FinancialAuditEvent.find(query).sort({ timestamp: 1 }).lean();
  }
}

export default FinancialAuditService;
