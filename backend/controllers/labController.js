import Workflow from "../models/Workflow.js";
import LabOrder from "../models/LabOrder.js";
import { assertWorkflowState } from "../services/clinicalWorkflowGuard.js";
import mongoose from "mongoose";

function resolveHospitalId(req) {
  const role = String(req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.body?.hospitalId || req.user?.hospital || null;
  }
  return req.user?.hospital || null;
}

export async function listLabs(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const limit = Math.min(Math.max(Number(req.query?.limit || 50), 1), 200);
    const requestedStatus = req.query?.status ? String(req.query.status).toLowerCase() : null;
    const status =
      requestedStatus === "completed" || requestedStatus === "lab_completed"
        ? "Completed"
        : requestedStatus === "pending" || requestedStatus === "lab_ordered"
        ? "Pending"
        : requestedStatus === "cancelled" || requestedStatus === "canceled"
        ? "Cancelled"
        : null;
    const filter = {
      hospital: hospitalId,
      ...(status ? { status } : {}),
    };

    const items = await LabOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("patient", "firstName lastName email")
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("List labs error:", err);
    return res.status(500).json({ message: "Failed to load labs" });
  }
}

export async function createLab(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const patient = String(req.body?.patient || "").trim();
    const testName = String(req.body?.testName || req.body?.testType || "").trim();
    const encounter = req.body?.encounter;

    if (!patient || !testName) {
      return res.status(400).json({ message: "patient and testType are required" });
    }

    const lab = new LabOrder({
      encounter: mongoose.Types.ObjectId.isValid(encounter)
        ? encounter
        : new mongoose.Types.ObjectId(),
      patient,
      hospital: hospitalId,
      testName,
      status: "Pending",
    });
    lab.$locals = { viaWorkflow: true };
    await lab.save();

    return res.status(201).json({ item: lab });
  } catch (err) {
    console.error("Create lab error:", err);
    return res.status(500).json({ message: "Failed to create lab order" });
  }
}

export async function uploadLabResult(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }
    const id = req.params?.id;
    const result = req.body?.result;
    const status = String(req.body?.status || "Completed");

    if (!id || !result) {
      return res.status(400).json({ message: "id and result are required" });
    }

    const lab = await LabOrder.findOne({ _id: id, hospital: hospitalId });
    if (!lab) {
      return res.status(404).json({ message: "Lab order not found" });
    }

    lab.result = typeof result === "string" ? result : JSON.stringify(result);
    lab.status = status === "Cancelled" ? "Cancelled" : "Completed";
    lab.completedAt = new Date();
    await lab.save();

    return res.json({ item: lab });
  } catch (err) {
    console.error("Upload lab result error:", err);
    return res.status(500).json({ message: "Failed to upload lab result" });
  }
}

export async function deleteLab(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }
    const id = req.params?.id;
    if (!id) return res.status(400).json({ message: "id is required" });

    const deleted = await LabOrder.findOneAndDelete({ _id: id, hospital: hospitalId });
    if (!deleted) {
      return res.status(404).json({ message: "Lab order not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete lab error:", err);
    return res.status(500).json({ message: "Failed to delete lab order" });
  }
}

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

    if (!encounterId) {
      return res.status(400).json({
        error: "encounterId is required",
      });
    }

    /* ================= WORKFLOW (OPTIONAL FALLBACK) ================= */
    const workflow = await Workflow.findOne({ encounter: encounterId });
    if (workflow) {
      assertWorkflowState(workflow, ["LAB_ORDERED"]);
    }

    /* ================= DUPLICATE GUARD ================= */
    const existing = await LabOrder.findOne({
      encounter: encounterId,
      status: "Completed",
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
        result:
          typeof results === "string"
            ? results
            : JSON.stringify(results || { autoCompleted: true }),
        notes,
        status: "Completed",
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
    if (workflow?.transition) {
      await workflow.transition("LAB_COMPLETED", req.user);
    }

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
