import { workflowService } from "./workflowService.js";
import { notifyPatient } from "./notificationService.js";

/**
 * SIDE EFFECTS
 * -----------------------------
 * - No direct DB writes
 * - No business rules
 * - No financial artifacts
 * - Deterministic & replayable
 */
export async function triggerSideEffects(state, wf, ctx = {}) {
  const baseContext = {
    hospital: wf.hospital,
    triggeredBy: wf.lastActor,
    parentWorkflow: wf.id,
  };

  switch (state) {
    /* ======================================================
       LAB ORDERED → START LAB WORKFLOW
    ====================================================== */
    case "LAB_ORDERED": {
      await workflowService.start("LAB", {
        ...baseContext,
        patient: wf.patient,
        encounter: wf.context.encounterId,
        tests: ctx.tests,
      });
      break;
    }

    /* ======================================================
       LAB COMPLETED → NOTIFY ONLY
    ====================================================== */
    case "LAB_COMPLETED": {
      await notifyPatient(wf.patient, "Lab results are ready");
      break;
    }

    /* ======================================================
       PRESCRIPTION CREATED → START PHARMACY WORKFLOW
    ====================================================== */
    case "PRESCRIPTION_CREATED": {
      await workflowService.start("PHARMACY", {
        ...baseContext,
        patient: wf.patient,
        prescriptionId: ctx.prescriptionId,
      });
      break;
    }

    /* ======================================================
       DISPENSED → START BILLING WORKFLOW
    ====================================================== */
    case "DISPENSED": {
      await workflowService.start("BILLING", {
        ...baseContext,
        patient: wf.patient,
        encounter: wf.context.encounterId,
        lineItems: ctx.billingItems,
        source: "PHARMACY",
      });
      break;
    }

    /* ======================================================
       PAID → NOTIFY + CLOSE LOOP
    ====================================================== */
    case "PAID": {
      await notifyPatient(
        wf.patient,
        "Payment received. Thank you."
      );
      break;
    }

    default:
      // No-op by design (safe for replay)
      break;
  }
}
