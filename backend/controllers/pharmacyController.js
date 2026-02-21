import Workflow from "../models/Workflow.js";
import Prescription from "../models/Prescription.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import { assertWorkflowState } from "../services/clinicalWorkflowGuard.js";

/* ======================================================
   CREATE PRESCRIPTION (WORKFLOW LOCKED)
   State: LAB_COMPLETED → PRESCRIPTION_CREATED
====================================================== */
export async function createPrescription(req, res) {
  try {
    const { encounterId, meds } = req.body;

    if (!encounterId || !Array.isArray(meds) || meds.length === 0) {
      return res.status(400).json({
        error: "encounterId and meds are required",
      });
    }

    /* ================= WORKFLOW ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId });

    assertWorkflowState(workflow, ["LAB_COMPLETED"]);

    /* ================= DUPLICATE GUARD ================= */
    const existing = await Prescription.findOne({
      encounter: encounterId,
    });

    if (existing) {
      return res.status(409).json({
        error: "Prescription already created for this encounter",
      });
    }

    /* ================= CREATE RX ================= */
    const rx = await Prescription.create({
      encounter: encounterId,
      meds,
      prescribedBy: req.user._id,
      hospital: req.user.hospital,
      status: "CREATED",
      $locals: { viaWorkflow: true },
    });

    /* ================= TRANSITION ================= */
    await workflow.transition("PRESCRIPTION_CREATED", req.user);

    return res.json(rx);
  } catch (err) {
    console.error("Create prescription error:", err);
    return res.status(400).json({
      error: err.message || "Failed to create prescription",
    });
  }
}

/* ======================================================
   DISPENSE MEDICATION (INSURANCE + WORKFLOW GUARDED)
   State: PRESCRIPTION_CREATED → DISPENSED
====================================================== */
export async function dispenseMedication(req, res) {
  try {
    const { encounterId, prescriptionId } = req.body;

    if (!encounterId || !prescriptionId) {
      return res.status(400).json({
        error: "encounterId and prescriptionId are required",
      });
    }

    /* ================= WORKFLOW ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId });

    assertWorkflowState(workflow, ["PRESCRIPTION_CREATED"]);

    /* ================= INSURANCE GUARD ================= */
    const auth = await InsuranceAuthorization.findOne({
      encounter: encounterId,
      status: "APPROVED",
    });

    if (!auth) {
      return res.status(403).json({
        error: "Insurance authorization required before dispensing",
      });
    }

    /* ================= RX ================= */
    const rx = await Prescription.findById(prescriptionId);

    if (!rx) {
      return res.status(404).json({
        error: "Prescription not found",
      });
    }

    if (rx.status === "DISPENSED") {
      return res.status(409).json({
        error: "Medication already dispensed",
      });
    }

    /* ================= DISPENSE ================= */
    rx.status = "DISPENSED";
    rx.dispensedBy = req.user._id;
    rx.dispensedAt = new Date();
    await rx.save();

    /* ================= TRANSITION ================= */
    await workflow.transition("DISPENSED", req.user);

    return res.json({
      status: "dispensed",
      prescription: rx,
    });
  } catch (err) {
    console.error("Dispense error:", err);
    return res.status(400).json({
      error: err.message || "Failed to dispense medication",
    });
  }
}
