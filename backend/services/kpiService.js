import Encounter from "../models/Encounter.js";
import Transaction from "../models/Transaction.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import Workflow from "../models/Workflow.js";
import { normalizeRole } from "../utils/normalizeRole.js";

/**
 * ADMIN — HOSPITAL KPI SNAPSHOT
 * 🔒 Admin only
 * 📊 Read-only
 * 🏥 Hospital isolated
 */
export async function hospitalKPIs(req, res, next) {
  try {
    const actor = req.user;

    /* ===========================
       ACCESS CONTROL
    ============================ */
    const role = normalizeRole(actor.role);
    if (!["HOSPITAL_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const hospital = actor.hospitalId;

    /* ===========================
       ENCOUNTERS
    ============================ */
    const totalEncounters = await Encounter.countDocuments({
      hospital,
    });

    const completedEncounters = await Workflow.countDocuments({
      hospital,
      state: "COMPLETED",
    });

    const activeEncounters =
      totalEncounters - completedEncounters;

    /* ===========================
       INSURANCE — SHA
    ============================ */
    const insurancePending = await InsuranceAuthorization.countDocuments({
      hospital,
      provider: "SHA",
      status: "PENDING",
    });

    const insuranceApproved = await InsuranceAuthorization.countDocuments({
      hospital,
      provider: "SHA",
      status: "APPROVED",
    });

    const insuranceRejected = await InsuranceAuthorization.countDocuments({
      hospital,
      provider: "SHA",
      status: "REJECTED",
    });

    /* ===========================
       CLINICAL FLOW (WORKFLOW AUTHORITY)
    ============================ */
    const labPending = await Workflow.countDocuments({
      hospital,
      state: "LAB_PENDING",
    });

    const pharmacyPending = await Workflow.countDocuments({
      hospital,
      state: "PRESCRIPTION_READY",
    });

    /* ===========================
       BILLING
    ============================ */
    const revenueAgg = await Transaction.aggregate([
      {
        $match: {
          hospital,
          "workflow.state": "PAID",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue =
      revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    const pendingPayments = await Transaction.countDocuments({
      hospital,
      "workflow.state": { $ne: "PAID" },
    });

    /* ===========================
       RESPONSE
    ============================ */
    res.json({
      encounters: {
        total: totalEncounters,
        active: activeEncounters,
        completed: completedEncounters,
      },

      insurance: {
        provider: "SHA",
        pending: insurancePending,
        approved: insuranceApproved,
        rejected: insuranceRejected,
      },

      flow: {
        labPending,
        pharmacyPending,
      },

      billing: {
        totalRevenue,
        pendingPayments,
      },
    });
  } catch (err) {
    next(err);
  }
}
