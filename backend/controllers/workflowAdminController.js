import Workflow from "../models/Workflow.js";
import AuditLog from "../models/AuditLog.js";

export async function adminOverride(req, res) {
  const { workflowId, targetState, reason } = req.body;

  if (!reason || reason.length < 10) {
    return res
      .status(400)
      .json({ error: "Override reason required (min 10 chars)" });
  }

  const workflow = await Workflow.findById(workflowId);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  const before = workflow.state;

  workflow.state = targetState;
  workflow.history.push({
    from: before,
    to: targetState,
    by: req.user._id,
    role: "admin",
    reason,
  });

  await workflow.save();

  await AuditLog.create({
    resource: "workflow",
    resourceId: workflow._id,
    action: "ADMIN_OVERRIDE",
    actorId: req.user._id,
    actorRole: "admin",
    before,
    after: targetState,
    meta: { reason },
  });

  res.json({ success: true });
}
