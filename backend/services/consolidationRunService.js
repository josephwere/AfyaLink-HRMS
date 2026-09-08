import ConsolidationRun from "../models/ConsolidationRun.js";
import ConsolidationAdjustment from "../models/ConsolidationAdjustment.js";
import ConsolidationElimination from "../models/ConsolidationElimination.js";
import ConsolidationReportSnapshot from "../models/ConsolidationReportSnapshot.js";
import ConsolidationApproval from "../models/ConsolidationApproval.js";
import ConsolidationRunEvent from "../models/ConsolidationRunEvent.js";
import ConsolidationSignatureService from "./consolidationSignatureService.js";
import JournalEntry from "../models/JournalEntry.js";
import JournalLine from "../models/JournalLine.js";
import FinancialAuditService from "./financialAuditService.js";

export class ConsolidationRunService {
  static async createRun({ groupId, period, createdBy = "system", metadata = {} } = {}) {
    return ConsolidationRun.create({
      groupId,
      period,
      status: "DRAFT",
      createdBy,
      metadata,
    });
  }

  static async finalizeRun(runId) {
    const run = await ConsolidationRun.findById(runId);
    if (!run) throw new Error("Consolidation run not found");
    run.status = "COMPLETED";
    run.completedAt = new Date();
    await run.save();
    return run;
  }

  static async transitionRun(runId, nextStatus, actor = "system", role = "ACCOUNTANT", { approverId = null, comment = "", signatureHash = null } = {}) {
    const run = await ConsolidationRun.findById(runId);
    if (!run) throw new Error("Consolidation run not found");

    const allowedStatuses = ["DRAFT", "CALCULATED", "REVIEWED", "APPROVED", "LOCKED", "PUBLISHED", "RUNNING", "COMPLETED", "FAILED"];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new Error("Unsupported consolidation run status");
    }

    const currentStatus = run.status;
    const allowedTransitions = {
      DRAFT: ["CALCULATED"],
      CALCULATED: ["REVIEWED"],
      REVIEWED: ["APPROVED"],
      APPROVED: ["LOCKED"],
      LOCKED: ["PUBLISHED"],
      PUBLISHED: [],
      RUNNING: ["COMPLETED", "FAILED"],
      COMPLETED: [],
      FAILED: [],
    };

    if (currentStatus !== nextStatus && !allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw new Error(`Transition from ${currentStatus} to ${nextStatus} is not permitted`);
    }

    const permittedRoles = {
      DRAFT: ["ACCOUNTANT", "FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
      CALCULATED: ["ACCOUNTANT", "FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
      REVIEWED: ["FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
      APPROVED: ["GROUP_CONTROLLER", "CFO"],
      LOCKED: ["CFO"],
      PUBLISHED: ["CFO"],
      RUNNING: ["ACCOUNTANT", "FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
      COMPLETED: ["ACCOUNTANT", "FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
      FAILED: ["ACCOUNTANT", "FINANCE_MANAGER", "GROUP_CONTROLLER", "CFO"],
    };

    if (!permittedRoles[nextStatus]?.includes(role)) {
      throw new Error(`Role ${role} is not permitted to transition to ${nextStatus}`);
    }

    const existingApprovals = await ConsolidationApproval.find({ consolidationRunId: run._id }).lean();
    const actorId = approverId || actor;
    const previousApprover = existingApprovals.find((approval) => approval.approverId === actorId);
    if (previousApprover && ["REVIEWED", "APPROVED", "LOCKED", "PUBLISHED"].includes(nextStatus)) {
      throw new Error("Separation of duties prevents the same user from completing multiple approval stages on the same run");
    }

    const eventTimestamp = new Date();
    const computedSignatureHash = signatureHash || ConsolidationSignatureService.computeSignatureHash({
      runId: String(run._id),
      eventType: "RUN_TRANSITION",
      actor,
      role,
      approverId: actorId,
      comment,
      timestamp: eventTimestamp,
      details: { fromStatus: currentStatus, toStatus: nextStatus },
    });

    run.status = nextStatus;
    await run.save();

    await ConsolidationApproval.create({
      consolidationRunId: run._id,
      approverId: actorId,
      approverRole: role,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      comment,
      signatureHash: computedSignatureHash,
    });

    await ConsolidationRunEvent.create({
      consolidationRunId: run._id,
      eventType: "RUN_TRANSITION",
      data: {
        fromStatus: currentStatus,
        toStatus: nextStatus,
        role,
        approverId: actorId,
        comment,
        signatureHash: computedSignatureHash,
      },
      createdBy: actor,
      createdRole: role,
      timestamp: eventTimestamp,
    });

    await FinancialAuditService.recordEvent({
      actor,
      action: `CONSOLIDATION_RUN_TRANSITION_${nextStatus}`,
      entityType: "ConsolidationRun",
      entityId: String(run._id),
      metadata: {
        from: currentStatus,
        to: nextStatus,
        role,
        approverId: actorId,
        comment,
        signatureHash: computedSignatureHash,
      },
    });

    return run;
  }

  static async getRunSummary(runId) {
    const run = await ConsolidationRun.findById(runId).lean();
    if (!run) throw new Error("Consolidation run not found");

    const adjustments = await ConsolidationAdjustment.find({ consolidationRunId: run._id }).lean();
    const eliminations = await ConsolidationElimination.find({ parentEntityId: run.groupId, status: "APPLIED" }).lean();
    const approvals = await ConsolidationApproval.find({ consolidationRunId: run._id }).lean();
    const events = await ConsolidationRunEvent.find({ consolidationRunId: run._id }).sort({ timestamp: 1 }).lean();

    return { run, adjustments, eliminations, approvals, events };
  }

  static async createSnapshot({ runId, reportType, content, version = "1.0" }, actor = "system", role = "ACCOUNTANT") {
    const run = await ConsolidationRun.findById(runId);
    if (!run) throw new Error("Consolidation run not found");
    if (!["APPROVED", "LOCKED", "PUBLISHED"].includes(run.status)) {
      throw new Error("Snapshots can only be created for approved or locked consolidation runs");
    }

    const snapshotHash = ConsolidationSignatureService.computeSignatureHash({
      runId: String(run._id),
      eventType: "SNAPSHOT_CREATED",
      actor,
      role,
      details: { reportType, version, content },
      timestamp: new Date(),
    });

    const snapshot = await ConsolidationReportSnapshot.create({
      consolidationRunId: run._id,
      reportType,
      content,
      version,
      createdBy: actor,
      createdRole: role,
      snapshotHash,
      isPublished: false,
    });

    await ConsolidationRunEvent.create({
      consolidationRunId: run._id,
      eventType: "SNAPSHOT_CREATED",
      data: { reportType, version, snapshotHash },
      createdBy: actor,
      createdRole: role,
    });

    await FinancialAuditService.recordEvent({
      actor,
      action: "CONSOLIDATION_SNAPSHOT_CREATED",
      entityType: "ConsolidationReportSnapshot",
      entityId: String(snapshot._id),
      metadata: { reportType, version, consolidationRunId: run._id, createdBy: actor, createdRole: role, snapshotHash },
    });

    return snapshot;
  }

  static async publishSnapshot(snapshotId, actor = "system", role = "CFO", { signatureHash = null, comment = "" } = {}) {
    const permittedPublishRoles = ["CFO"];
    if (!permittedPublishRoles.includes(role)) {
      throw new Error(`Role ${role} is not permitted to publish snapshots`);
    }
    const snapshot = await ConsolidationReportSnapshot.findById(snapshotId);
    if (!snapshot) throw new Error("Report snapshot not found");
    if (snapshot.isPublished) {
      throw new Error("Snapshot has already been published");
    }

    const publishTimestamp = new Date();
    const computedSignatureHash = signatureHash || ConsolidationSignatureService.computeSignatureHash({
      runId: String(snapshot.consolidationRunId),
      eventType: "SNAPSHOT_PUBLISHED",
      actor,
      role,
      comment,
      timestamp: publishTimestamp,
      details: { reportType: snapshot.reportType, version: snapshot.version, snapshotHash: snapshot.snapshotHash },
    });

    snapshot.isPublished = true;
    snapshot.publishedAt = publishTimestamp;
    snapshot.publishedBy = actor;
    snapshot.publishedRole = role;
    snapshot.publishedSignatureHash = computedSignatureHash;
    snapshot.publishedComment = comment;
    await snapshot.save();

    await ConsolidationRunEvent.create({
      consolidationRunId: snapshot.consolidationRunId,
      eventType: "SNAPSHOT_PUBLISHED",
      data: { snapshotId: snapshot._id, reportType: snapshot.reportType, version: snapshot.version, publishedBy: actor, publishedRole: role, publishedSignatureHash: computedSignatureHash, comment },
      createdBy: actor,
      createdRole: role,
      timestamp: publishTimestamp,
    });

    await FinancialAuditService.recordEvent({
      actor,
      action: "CONSOLIDATION_SNAPSHOT_PUBLISHED",
      entityType: "ConsolidationReportSnapshot",
      entityId: String(snapshot._id),
      metadata: {
        reportType: snapshot.reportType,
        version: snapshot.version,
        publishedBy: actor,
        publishedRole: role,
        publishedSignatureHash: computedSignatureHash,
        publishedComment: comment,
      },
    });

    return snapshot;
  }

  static async createEliminationJournal({ runId, accountCode, amount, direction, description }) {
    const run = await ConsolidationRun.findById(runId);
    if (!run) throw new Error("Consolidation run not found");

    const entry = await JournalEntry.create({
      entryNumber: `CJ-${Date.now()}`,
      entryType: "ADJUSTMENT",
      hospitalId: run.groupId,
      description: description || "Intercompany elimination",
      currency: "KES",
      totalDebit: direction === "DEBIT" ? amount : 0,
      totalCredit: direction === "CREDIT" ? amount : 0,
      isImmutable: true,
      metadata: { consolidationRunId: run._id, source: "consolidation" },
    });

    await JournalLine.create({
      journalEntryId: entry._id,
      accountCode,
      accountName: accountCode,
      direction,
      amount,
      description: description || "Intercompany elimination",
    });

    return entry;
  }
}

export default ConsolidationRunService;
