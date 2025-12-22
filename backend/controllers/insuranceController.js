import Encounter from "../models/Encounter.js";
import { requestShaPreauth } from "../services/shaService.js";
import workflowService from "../services/workflowService.js";

/* ======================================================
   SHA PRE-AUTH (STANDARD FLOW)
====================================================== */
export async function shaPreauthorize(req, res) {
  const { encounterId } = req.body;

  if (!encounterId) {
    return res.status(400).json({ error: "encounterId required" });
  }

  const encounter = await Encounter.findById(encounterId)
    .populate("patient")
    .populate("workflow");

  if (!encounter) {
    return res.status(404).json({ error: "Encounter not found" });
  }

  const allowed =
    encounter.workflow?.allowedTransitions?.includes(
      "INSURANCE_PREAUTHORIZED"
    );

  if (!allowed) {
    return res.status(409).json({
      error: "Insurance pre-authorization not allowed at this stage",
    });
  }

  const result = await requestShaPreauth({
    encounter,
    patient: encounter.patient,
  });

  if (result.status !== "APPROVED") {
    await workflowService.transition({
      workflowId: encounter.workflow._id,
      to: "INSURANCE_REJECTED",
      actor: req.user,
      meta: {
        provider: "SHA",
        reason: result.reason || "Rejected by SHA",
      },
    });

    return res.status(402).json({
      error: "Insurance rejected",
      reason: result.reason,
    });
  }

  await workflowService.transition({
    workflowId: encounter.workflow._id,
    to: "INSURANCE_APPROVED",
    actor: req.user,
    meta: {
      provider: "SHA",
      authorizationCode: result.authorizationCode,
    },
  });

  res.json({
    success: true,
    provider: "SHA",
    authorizationCode: result.authorizationCode,
  });
}

/* ======================================================
   ADMIN OVERRIDE — APPROVE
====================================================== */
export async function adminApproveInsurance(req, res) {
  const { encounterId, justification } = req.body;

  if (!encounterId || !justification) {
    return res.status(400).json({
      error: "encounterId and justification are required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const encounter = await Encounter.findById(encounterId).populate("workflow");

  if (!encounter || !encounter.workflow) {
    return res.status(404).json({ error: "Encounter/workflow not found" });
  }

  const allowed =
    encounter.workflow.allowedTransitions?.includes(
      "INSURANCE_APPROVED"
    );

  if (!allowed) {
    return res.status(409).json({
      error: "Insurance approval override not allowed",
    });
  }

  await workflowService.transition({
    workflowId: encounter.workflow._id,
    to: "INSURANCE_APPROVED",
    actor: req.user,
    meta: {
      provider: "SHA",
      override: true,
      justification,
    },
  });

  res.json({
    success: true,
    override: "APPROVED",
  });
}

/* ======================================================
   ADMIN OVERRIDE — REJECT
====================================================== */
export async function adminRejectInsurance(req, res) {
  const { encounterId, justification } = req.body;

  if (!encounterId || !justification) {
    return res.status(400).json({
      error: "encounterId and justification are required",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const encounter = await Encounter.findById(encounterId).populate("workflow");

  if (!encounter || !encounter.workflow) {
    return res.status(404).json({ error: "Encounter/workflow not found" });
  }

  const allowed =
    encounter.workflow.allowedTransitions?.includes(
      "INSURANCE_REJECTED"
    );

  if (!allowed) {
    return res.status(409).json({
      error: "Insurance rejection override not allowed",
    });
  }

  await workflowService.transition({
    workflowId: encounter.workflow._id,
    to: "INSURANCE_REJECTED",
    actor: req.user,
    meta: {
      provider: "SHA",
      override: true,
      justification,
    },
  });

  res.json({
    success: true,
    override: "REJECTED",
  });
}
