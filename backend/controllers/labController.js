import Workflow from "../models/Workflow.js";
import LabOrder from "../models/LabOrder.js";
import { assertWorkflowState } from "../services/clinicalWorkflowGuard.js";

/**
 * COMPLETE LAB
 * 🔒 Workflow enforced
 * State: LAB_ORDERED → LAB_COMPLETED
 * Never mutates encounter directly
 */
export async function completeLab(req, res) {
  try {
    const {
      encounterId,
      results,
      notes,
    } = req.body;

    if (!encounterId || !results) {
      return res.status(400).json({
        error: "encounterId and results are required",
      });
    }

    /* ================= WORKFLOW ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId });

    assertWorkflowState(workflow, ["LAB_ORDERED"]);

    /* ================= DUPLICATE GUARD ================= */
    const existing = await LabOrder.findOne({
      encounter: encounterId,
      status: "COMPLETED",
    });

    if (existing) {
      return res.status(409).json({
        error: "Lab already completed for this encounter",
      });
    }

    /* ================= COMPLETE LAB ================= */
    const lab = await LabOrder.findOneAndUpdate(
      { encounter: encounterId },
      {
        results,
        notes,
        status: "COMPLETED",
        completedBy: req.user._id,
        completedAt: new Date(),
      },
      { new: true }
    );

    if (!lab) {
      return res.status(404).json({
        error: "Lab order not found",
      });
    }

    /* ================= TRANSITION ================= */
    await workflow.transition("LAB_COMPLETED", req.user);

    return res.json({
      status: "completed",
      lab,
    });
  } catch (err) {
    console.error("Complete lab error:", err);
    return res.status(400).json({
      error: err.message || "Failed to complete lab",
    });
  }
}
