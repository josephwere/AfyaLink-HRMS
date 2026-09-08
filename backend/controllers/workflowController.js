import WorkItem from "../models/WorkItem.js";
import { applyWorkItemAction, createWorkItem } from "../services/workflowService.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function getHospitalId(req) {
  return req.user?.hospital || req.user?.hospitalId || null;
}

function isFinance(role) {
  const r = normalizeRole(role);
  return ["ACCOUNTANT", "FINANCE_MANAGER", "CFO", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(r);
}

export const listWorkItems = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });
  const query = { hospital: hospitalId };
  if (!isFinance(req.user?.role)) query.assignedTo = req.user._id;
  const items = await WorkItem.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return res.json(items);
};

export const actionOnWorkItem = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });
  const { id } = req.params;
  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ message: "Action required" });
  try {
    const result = await applyWorkItemAction({ workItemId: id, action, actorId: req.user._id, actorRole: req.user.role, payload: payload || {} });
    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
};

export const createItem = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) return res.status(400).json({ message: "Hospital context required" });
  const { type, module, priority, assignedTo, metadata, actionUrl } = req.body || {};
  if (!type) return res.status(400).json({ message: "Type is required" });
  const item = await createWorkItem({ hospital: hospitalId, type, module, priority, createdBy: req.user._id, metadata: metadata || {}, actionUrl: actionUrl || "" });
  return res.status(201).json(item);
};
import Workflow from "../models/Workflow.js";
import AuditLog from "../models/AuditLog.js";
import { calculateSLA } from "../services/slaService.js";

/**
 * SLA RULE DEFINITIONS
 */
const SLA_RULES = [
  {
    name: "Insurance Approval",
    start: "INSURANCE_PENDING",
    end: ["INSURANCE_APPROVED", "INSURANCE_REJECTED"],
    thresholdMs: 30 * 60 * 1000, // 30 minutes
  },
  {
    name: "Lab Turnaround",
    start: "LAB_PENDING",
    end: ["LAB_COMPLETED"],
    thresholdMs: 60 * 60 * 1000, // 60 minutes
  },
];

/**
 * GET WORKFLOW TIMELINE
 * 🔒 READ-ONLY
 *
 * Used by:
 * - Doctor encounter view
 * - Admin audit view
 *
 * NEVER mutates state.
 */
export async function getWorkflowTimeline(req, res) {
  try {
    const { encounterId } = req.params;

    if (!encounterId) {
      return res.status(400).json({ error: "encounterId is required" });
    }

    /* ================= WORKFLOW ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId }).lean();

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    /* ================= AUDIT LOGS ================= */
    const audits = await AuditLog.find({
      resource: "workflow",
      resourceId: workflow._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    /* ================= SLA ================= */
    const sla = calculateSLA(workflow, SLA_RULES);

    /* ================= RESPONSE ================= */
    return res.json({
      workflow: {
        id: workflow._id,
        state: workflow.state,
        allowedTransitions: workflow.allowedTransitions || [],
        history: workflow.history || [],
        createdAt: workflow.createdAt,
      },
      audit: audits.map((a) => ({
        id: a._id,
        action: a.action,
        actorId: a.actorId,
        actorRole: a.actorRole,
        at: a.createdAt,
        before: a.before,
        after: a.after,
      })),
      sla,
    });
  } catch (err) {
    console.error("Workflow timeline error:", err);
    res.status(500).json({ error: "Failed to load workflow timeline" });
  }
}
