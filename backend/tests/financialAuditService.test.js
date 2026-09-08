import { jest } from "@jest/globals";

const auditCreate = jest.fn();
const auditFind = jest.fn();

jest.unstable_mockModule("../models/FinancialAuditEvent.js", () => ({
  default: {
    create: auditCreate,
    find: auditFind,
  },
}));

describe("financial audit service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records an audit event", async () => {
    auditCreate.mockResolvedValue({ _id: "audit-1" });

    const { FinancialAuditService } = await import("../services/financialAuditService.js");
    const result = await FinancialAuditService.recordEvent({ actor: "alice", action: "APPROVED", entityType: "ConsolidationRun", entityId: "run-1" });

    expect(result._id).toBe("audit-1");
  });

  it("retrieves an audit trail for an entity", async () => {
    auditFind.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ action: "APPROVED" }]) }) });

    const { FinancialAuditService } = await import("../services/financialAuditService.js");
    const result = await FinancialAuditService.getAuditTrail({ entityType: "ConsolidationRun", entityId: "run-1" });

    expect(result).toEqual([{ action: "APPROVED" }]);
  });
});
