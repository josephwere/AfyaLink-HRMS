import { jest } from "@jest/globals";

const consolidationRunCreate = jest.fn();
const consolidationRunFindById = jest.fn();
const consolidationReportSnapshotCreate = jest.fn();
const consolidationReportSnapshotFindById = jest.fn();
const consolidationApprovalCreate = jest.fn();
const consolidationApprovalFind = jest.fn();
const consolidationRunEventCreate = jest.fn();
const signatureCompute = jest.fn();
const financialAuditRecord = jest.fn();

jest.unstable_mockModule("../models/ConsolidationRun.js", () => ({
  default: {
    create: consolidationRunCreate,
    findById: consolidationRunFindById,
  },
}));

jest.unstable_mockModule("../models/ConsolidationReportSnapshot.js", () => ({
  default: {
    create: consolidationReportSnapshotCreate,
    findById: consolidationReportSnapshotFindById,
  },
}));

jest.unstable_mockModule("../models/ConsolidationApproval.js", () => ({
  default: {
    create: consolidationApprovalCreate,
    find: consolidationApprovalFind,
  },
}));

jest.unstable_mockModule("../models/ConsolidationRunEvent.js", () => ({
  default: {
    create: consolidationRunEventCreate,
  },
}));

jest.unstable_mockModule("../services/consolidationSignatureService.js", () => ({
  default: {
    computeSignatureHash: signatureCompute,
  },
}));

jest.unstable_mockModule("../services/financialAuditService.js", () => ({
  default: {
    recordEvent: financialAuditRecord,
  },
}));

describe("consolidation run governance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records an approval and restricts transition roles", async () => {
    const save = jest.fn().mockResolvedValue(true);
    consolidationRunFindById.mockResolvedValue({ _id: "run-1", status: "REVIEWED", save });
    consolidationApprovalFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const { ConsolidationRunService } = await import("../services/consolidationRunService.js");
    const result = await ConsolidationRunService.transitionRun(
      "run-1",
      "APPROVED",
      "system-user",
      "GROUP_CONTROLLER",
      { approverId: "user-123", comment: "Review complete", signatureHash: "sig-hash" }
    );

    expect(result.status).toBe("APPROVED");
    expect(save).toHaveBeenCalled();
    expect(consolidationApprovalCreate).toHaveBeenCalledWith(expect.objectContaining({
      consolidationRunId: "run-1",
      approverId: "user-123",
      approverRole: "GROUP_CONTROLLER",
      fromStatus: "REVIEWED",
      toStatus: "APPROVED",
      comment: "Review complete",
      signatureHash: "sig-hash",
    }));
    expect(consolidationRunEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      consolidationRunId: "run-1",
      eventType: "RUN_TRANSITION",
      data: expect.objectContaining({ fromStatus: "REVIEWED", toStatus: "APPROVED", role: "GROUP_CONTROLLER" }),
    }));
    expect(financialAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONSOLIDATION_RUN_TRANSITION_APPROVED",
      entityType: "ConsolidationRun",
      entityId: "run-1",
    }));
  });

  it("rejects same approver for multiple approval stages", async () => {
    const save = jest.fn().mockResolvedValue(true);
    consolidationRunFindById.mockResolvedValue({ _id: "run-1", status: "REVIEWED", save });
    consolidationApprovalFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([{ approverId: "user-123", toStatus: "REVIEWED" }]) });

    const { ConsolidationRunService } = await import("../services/consolidationRunService.js");

    await expect(
      ConsolidationRunService.transitionRun(
        "run-1",
        "APPROVED",
        "system-user",
        "GROUP_CONTROLLER",
        { approverId: "user-123", comment: "Review complete", signatureHash: "sig-hash" }
      )
    ).rejects.toThrow("Separation of duties prevents the same user from completing multiple approval stages on the same run");
  });

  it("publishes an immutable report snapshot with CFO signature evidence", async () => {
    const save = jest.fn().mockResolvedValue(true);
    consolidationReportSnapshotFindById.mockResolvedValue({
      _id: "snapshot-1",
      isPublished: false,
      publishedAt: null,
      reportType: "BALANCE_SHEET",
      version: "1.0",
      consolidationRunId: "run-1",
      snapshotHash: "snapshot-hash",
      save,
    });

    const { ConsolidationRunService } = await import("../services/consolidationRunService.js");
    const result = await ConsolidationRunService.publishSnapshot(
      "snapshot-1",
      "cfo-user",
      "CFO",
      { signatureHash: "publish-sig", comment: "Year-end publication" }
    );

    expect(result.isPublished).toBe(true);
    expect(result.publishedBy).toBe("cfo-user");
    expect(result.publishedRole).toBe("CFO");
    expect(result.publishedSignatureHash).toBe("publish-sig");
    expect(save).toHaveBeenCalled();
    expect(consolidationRunEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      consolidationRunId: "run-1",
      eventType: "SNAPSHOT_PUBLISHED",
      data: expect.objectContaining({ publishedBy: "cfo-user", publishedRole: "CFO", publishedSignatureHash: "publish-sig" }),
    }));
    expect(financialAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONSOLIDATION_SNAPSHOT_PUBLISHED",
      entityType: "ConsolidationReportSnapshot",
      entityId: "snapshot-1",
      metadata: expect.objectContaining({ publishedBy: "cfo-user", publishedRole: "CFO", publishedSignatureHash: "publish-sig" }),
    }));
  });
});
