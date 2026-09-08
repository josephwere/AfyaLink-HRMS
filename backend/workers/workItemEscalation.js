import WorkItem from "../models/WorkItem.js";
import { notifyRolesInHospital } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";

export async function runWorkItemEscalation(now = new Date()) {
  // find items with SLA configured and not completed
  const dueItems = await WorkItem.find({ status: { $in: ["PENDING", "IN_PROGRESS"] }, slaHours: { $gt: 0 } }).lean();
  for (const it of dueItems) {
    try {
      const created = new Date(it.createdAt || it._id.getTimestamp());
      const deadline = new Date(created.getTime() + (it.slaHours || 0) * 60 * 60 * 1000);
      if (now < deadline) continue;

      // avoid repeated escalation spam - track in metadata
      const meta = it.metadata || {};
      meta.escalationCount = (meta.escalationCount || 0) + 1;
      meta.lastEscalatedAt = now;

      // determine roles to notify: try next approval level roles, fallback to HOSPITAL_ADMIN
      const levels = it.approvalLevels || [];
      const current = (meta.approvalState && meta.approvalState.currentLevel) || 0;
      const next = levels[current] || null;
      const roles = (next && next.roles && next.roles.length) ? next.roles : ["HOSPITAL_ADMIN", "FINANCE_MANAGER"];

      await WorkItem.updateOne({ _id: it._id }, { $set: { metadata: meta, status: "IN_PROGRESS" } });
      await logAudit({ action: "WORKITEM_ESCALATED", resource: "WorkItem", resourceId: it._id, after: { metadata: meta }, hospital: it.hospital, actorId: null });

      await notifyRolesInHospital({ hospital: it.hospital, roles, title: `Escalation: ${it.type}`, body: `Work item ${String(it._id)} has breached SLA and was escalated`, meta: { workItemId: String(it._id), escalationCount: meta.escalationCount } });
    } catch (e) {
      console.error("Escalation worker error", e);
    }
  }
}

export default runWorkItemEscalation;
