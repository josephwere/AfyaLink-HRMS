import Workflow from "../models/Workflow.js";
import { transitionWorkflow } from "../services/workflowEngine.js";

/**
 * ADMIN OVERRIDE — FORCE APPROVE / REJECT
 * 🔐 ADMIN ONLY
 * 🔐 JUSTIFICATION REQUIRED
 */
export async function adminOverrideWorkflow(req, res) {
  try {
    const { workflowId, decision, reason } = req.body;
    const actor = req.user;

    if (actor.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin only" });
    }

    if (!workflowId || !decision || !reason) {
      return res.status(400).json({
        error: "workflowId, decision and reason are required",
      });
    }

    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    const wf = await Workflow.findById(workflowId);
    if (!wf) return res.status(404).json({ error: "Workflow not found" });

    // 🔐 Hospital isolation
    if (String(wf.hospital) !== String(actor.hospitalId)) {
      return res.status(403).json({ error: "Cross-hospital access denied" });
    }

    const to =
      decision === "APPROVE"
        ? "ADMIN_OVERRIDE_APPROVE"
        : "ADMIN_OVERRIDE_REJECT";

    await transitionWorkflow({
      workflowId: wf._id,
      to,
      actor,
      ctx: {
        override: true,
        reason,
        decidedBy: actor.id,
        decidedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: `Workflow ${decision.toLowerCase()}d by admin`,
    });
  } catch (err) {
    console.error("Admin override error:", err);
    res.status(500).json({ error: err.message });
  }
}
