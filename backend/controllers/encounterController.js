import workflowService from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import Invoice from "../models/Invoice.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import Encounter from "../models/Encounter.js";

function resolveHospitalId(req) {
  const role = String(req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.user?.hospital || req.user?.hospitalId || null;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

function toAllowedTransitions(state) {
  switch (state) {
    case WORKFLOW.LAB_ORDERED:
      return ["LAB_COMPLETED"];
    case WORKFLOW.PRESCRIPTION_CREATED:
      return ["DISPENSED"];
    case WORKFLOW.BILLED:
      return ["PAID"];
    default:
      return [];
  }
}

export const listEncounters = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.json([]);
    }

    const stage = String(req.query?.stage || "").toUpperCase();
    const limit = Math.min(Math.max(parseInt(req.query?.limit || "50", 10), 1), 200);

    const stateFilter = {};
    if (stage === "LAB") {
      stateFilter.state = WORKFLOW.LAB_ORDERED;
    } else if (stage === "PHARMACY") {
      stateFilter.state = WORKFLOW.PRESCRIPTION_CREATED;
    }

    const rows = await Encounter.find({
      hospital: hospitalId,
      ...stateFilter,
    })
      .populate("patient", "firstName lastName")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const items = rows.map((row) => ({
      ...row,
      patient: row.patient
        ? {
            ...row.patient,
            name: [row.patient.firstName, row.patient.lastName].filter(Boolean).join(" ").trim(),
          }
        : null,
      workflow: {
        state: row.state,
        allowedTransitions: toAllowedTransitions(row.state),
      },
    }));

    return res.json(items);
  } catch (err) {
    console.error("List encounters error:", err);
    return res.status(500).json({ message: "Failed to load encounters" });
  }
};

/**
 * CLOSE ENCOUNTER — WORKFLOW GUARDED
 * 🔒 Financially & clinically safe
 */
export const closeEncounter = async (req, res) => {
  try {
    const encounterId = req.params.id;

    /* ===============================
       🔐 INSURANCE / PAYMENT CHECK
    =============================== */

    // Check insurance (if encounter is insured)
    const insuranceAuth = await InsuranceAuthorization.findOne({
      encounter: encounterId,
    });

    if (
      insuranceAuth &&
      insuranceAuth.status !== "APPROVED"
    ) {
      return res.status(403).json({
        error:
          "Encounter cannot be closed — insurance not approved",
      });
    }

    // Check outstanding payments
    const unpaid = await Invoice.findOne({
      encounter: encounterId,
      status: { $ne: "Paid" },
    });

    if (unpaid) {
      return res.status(403).json({
        error:
          "Encounter cannot be closed — pending payment",
      });
    }

    /* ===============================
       🔄 WORKFLOW TRANSITION
    =============================== */
    const encounter = await workflowService.transitionEncounter(
      encounterId,
      WORKFLOW.CLOSED,
      {
        actorId: req.user._id,
        actorRole: req.user.role,
        reason: "Encounter closed",
      }
    );

    res.json(encounter);
  } catch (err) {
    console.error("Close encounter failed:", err);
    res.status(500).json({
      error: err.message || "Failed to close encounter",
    });
  }
};
