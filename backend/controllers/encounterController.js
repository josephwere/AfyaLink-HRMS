import { transitionEncounter } from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import BillingTransaction from "../models/BillingTransaction.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";

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
    const unpaid = await BillingTransaction.findOne({
      encounter: encounterId,
      status: { $ne: "success" },
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
    const encounter = await transitionEncounter(
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
