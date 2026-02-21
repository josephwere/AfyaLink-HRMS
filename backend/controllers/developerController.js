import Audit from "../models/Audit.js";
import AuditLog from "../models/AuditLog.js";
import Hospital from "../models/Hospital.js";
import ComplianceLedger from "../models/ComplianceLedger.js";
import TransferConsent from "../models/TransferConsent.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import { integrationQueue, integrationDLQ } from "../services/integrationQueue.js";
import { notificationQueue } from "../services/queue.js";
import { webhookQueue } from "../services/webhookQueue.js";
import { checkWorkflowSLA } from "../services/workflowSlaService.js";

async function getQueueCounts(queue) {
  if (!queue?.getJobCounts) return null;
  return queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
}

export const getDeveloperOverview = async (_req, res) => {
  try {
    const [
      integrationCounts,
      dlqCounts,
      notificationCounts,
      webhookCounts,
      leavePending,
      overtimePending,
      shiftPending,
      workforceBreached,
    ] =
      await Promise.all([
        getQueueCounts(integrationQueue),
        getQueueCounts(integrationDLQ),
        getQueueCounts(notificationQueue),
        getQueueCounts(webhookQueue),
        LeaveRequest.countDocuments({ status: "PENDING" }),
        OvertimeRequest.countDocuments({ status: "PENDING" }),
        ShiftRequest.countDocuments({ status: "PENDING" }),
        Promise.all([
          LeaveRequest.countDocuments({
            status: "PENDING",
            $or: [{ slaBreachedAt: { $ne: null } }, { slaDueAt: { $lte: new Date() } }],
          }),
          OvertimeRequest.countDocuments({
            status: "PENDING",
            $or: [{ slaBreachedAt: { $ne: null } }, { slaDueAt: { $lte: new Date() } }],
          }),
          ShiftRequest.countDocuments({
            status: "PENDING",
            $or: [{ slaBreachedAt: { $ne: null } }, { slaDueAt: { $lte: new Date() } }],
          }),
        ]),
      ]);

    const webhookLogs = await Audit.find({
      action: { $regex: /^webhook\./ },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const hospitals = await Hospital.find().select("features").lean();
    const totals = {};
    hospitals.forEach((h) => {
      const features = h.features || {};
      Object.keys(features).forEach((key) => {
        totals[key] = totals[key] || { enabled: 0, disabled: 0 };
        if (features[key]) totals[key].enabled += 1;
        else totals[key].disabled += 1;
      });
    });

    res.json({
      queues: {
        integration: integrationCounts || {},
        dlq: dlqCounts || {},
        notifications: notificationCounts || {},
        webhook: webhookCounts || {},
        workforce: {
          leavePending,
          overtimePending,
          shiftPending,
          totalPending: leavePending + overtimePending + shiftPending,
          breached: workforceBreached.reduce((sum, n) => sum + n, 0),
        },
      },
      webhookLogs,
      featureFlags: {
        hospitals: hospitals.length,
        totals,
      },
    });
  } catch (err) {
    console.error("Developer overview error:", err);
    res.status(500).json({ message: "Failed to load developer overview" });
  }
};

export const getTrustStatus = async (_req, res) => {
  try {
    const [
      ledgerWrites24h,
      policyDenials24h,
      consentDenials24h,
      highRiskStepUps24h,
      activeConsents,
    ] = await Promise.all([
      ComplianceLedger.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      AuditLog.countDocuments({
        action: "ACCESS_DENIED",
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      AuditLog.countDocuments({
        action: { $in: ["TRANSFER_FHIR_EXPORTED", "TRANSFER_HL7_EXPORTED"] },
        success: false,
        error: /consent|required/i,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      AuditLog.countDocuments({
        action: "LOGIN_RISK_STEPUP_REQUIRED",
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      TransferConsent.countDocuments({ status: "GRANTED" }),
    ]);

    return res.json({
      window: "24h",
      trust: {
        ledgerWrites24h,
        policyDenials24h,
        consentDenials24h,
        highRiskStepUps24h,
        activeConsents,
      },
    });
  } catch (err) {
    console.error("Trust status error:", err);
    return res.status(500).json({ message: "Failed to load trust status" });
  }
};

export const runWorkflowSlaScan = async (_req, res) => {
  try {
    const result = await checkWorkflowSLA();
    return res.json({
      ok: true,
      ranAt: new Date(),
      result,
    });
  } catch (err) {
    console.error("Run workflow SLA scan error:", err);
    return res.status(500).json({ message: "Failed to run workflow SLA scan" });
  }
};

export const getDecisionCockpit = async (req, res) => {
  try {
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      dlqCounts,
      leavePending,
      overtimePending,
      shiftPending,
      recentAbacDenials,
      ledgerWrites24h,
      policyDenials24h,
      consentDenials24h,
      highRiskStepUps24h,
      activeConsents,
    ] =
      await Promise.all([
        getQueueCounts(integrationDLQ),
        LeaveRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
        OvertimeRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
        ShiftRequest.countDocuments({ ...(hospital ? { hospital } : {}), status: "PENDING" }),
        AuditLog.countDocuments({
          action: "ABAC_DENIED",
          ...(hospital ? { hospital } : {}),
          createdAt: { $gte: since24h },
        }),
        ComplianceLedger.countDocuments({
          ...(hospital ? { hospital } : {}),
          createdAt: { $gte: since24h },
        }),
        AuditLog.countDocuments({
          ...(hospital ? { hospital } : {}),
          action: "ACCESS_DENIED",
          createdAt: { $gte: since24h },
        }),
        AuditLog.countDocuments({
          ...(hospital ? { hospital } : {}),
          action: { $in: ["TRANSFER_FHIR_EXPORTED", "TRANSFER_HL7_EXPORTED"] },
          success: false,
          error: /consent|required/i,
          createdAt: { $gte: since24h },
        }),
        AuditLog.countDocuments({
          ...(hospital ? { hospital } : {}),
          action: "LOGIN_RISK_STEPUP_REQUIRED",
          createdAt: { $gte: since24h },
        }),
        TransferConsent.countDocuments({ ...(hospital ? { fromHospital: hospital } : {}), status: "GRANTED" }),
      ]);

    const workforcePending = leavePending + overtimePending + shiftPending;
    const anomalies = [];

    if ((dlqCounts?.failed || 0) > 0) {
      anomalies.push({
        id: "dlq_failed",
        severity: (dlqCounts.failed || 0) > 100 ? "HIGH" : "MEDIUM",
        title: "Integration DLQ failures detected",
        metric: dlqCounts.failed || 0,
        why: "Failed integration jobs can delay interoperability and workflows.",
        action: "Inspect DLQ and replay blocked jobs with corrected payloads.",
      });
    }
    if (workforcePending > 200) {
      anomalies.push({
        id: "workforce_backlog",
        severity: workforcePending > 500 ? "HIGH" : "MEDIUM",
        title: "Workforce approval backlog rising",
        metric: workforcePending,
        why: "Large approval backlog may increase SLA breaches and operational risk.",
        action: "Apply aggressive automation preset and run escalation sweep.",
      });
    }
    if (recentAbacDenials > 20) {
      anomalies.push({
        id: "abac_denials",
        severity: recentAbacDenials > 100 ? "HIGH" : "MEDIUM",
        title: "Frequent ABAC denials",
        metric: recentAbacDenials,
        why: "High deny volume may indicate policy misconfiguration or abuse attempts.",
        action: "Review ABAC policies and denied request patterns.",
      });
    }

    const recommendations = [
      {
        type: "security",
        text: "Review ABAC policy priority order and activate deny-first rules for high-risk export surfaces.",
      },
      {
        type: "operations",
        text: "Run workflow SLA scan and auto-escalation sweep for pending workforce queues.",
      },
      {
        type: "interop",
        text: "Replay failed webhook/DLQ jobs and monitor provenance signatures for transfer exports.",
      },
    ];

    return res.json({
      generatedAt: new Date(),
      window: {
        last24h: since24h,
        last7d: since7d,
      },
      totals: {
        dlqFailed: dlqCounts?.failed || 0,
        workforcePending,
        abacDenials24h: recentAbacDenials,
      },
      anomalies,
      recommendations,
      trust: {
        ledgerWrites24h,
        policyDenials24h,
        consentDenials24h,
        highRiskStepUps24h,
        activeConsents,
      },
    });
  } catch (err) {
    console.error("Decision cockpit error:", err);
    return res.status(500).json({ message: "Failed to load decision cockpit" });
  }
};
