import Workflow from "../models/Workflow.js";
import Diagnosis from "../models/Diagnosis.js";
import { assertWorkflowState } from "../services/clinicalWorkflowGuard.js";

/**
 * CREATE DIAGNOSIS
 * 🔒 Workflow enforced
 * Allowed only once per encounter
 * State: ENCOUNTER_STARTED → DIAGNOSED
 */
export async function createDiagnosis(req, res) {
  try {
    const { encounterId, diagnosis } = req.body;

    if (!encounterId || !diagnosis) {
      return res.status(400).json({
        error: "encounterId and diagnosis are required",
      });
    }

    /* ================= WORKFLOW ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId });

    assertWorkflowState(workflow, ["ENCOUNTER_STARTED"]);

    /* ================= DUPLICATE GUARD ================= */
    const existing = await Diagnosis.findOne({ encounter: encounterId });
    if (existing) {
      return res.status(409).json({
        error: "Diagnosis already exists for this encounter",
      });
    }

    /* ================= CREATE DIAGNOSIS ================= */
    const diag = await Diagnosis.create({
      encounter: encounterId,
      diagnosis,
      doctor: req.user._id,
      hospital: req.user.hospital,
      $locals: { viaWorkflow: true }, // 🔐 audit-safe
    });

    /* ================= TRANSITION ================= */
    await workflow.transition("DIAGNOSED", req.user);

    return res.json(diag);
  } catch (err) {
    console.error("Create diagnosis error:", err);
    return res.status(400).json({
      error: err.message || "Failed to create diagnosis",
    });
  }
}
