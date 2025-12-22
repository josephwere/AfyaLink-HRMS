import Diagnosis from "../../models/Diagnosis.js";
import LabOrder from "../../models/LabOrder.js";
import Prescription from "../../models/Prescription.js";
import Invoice from "../../models/Invoice.js";
import Encounter from "../../models/Encounter.js";
import { notify } from "../notificationService.js";
import { logAudit } from "../auditService.js";

/**
 * CONSULTATION WORKFLOW EFFECTS
 * Triggered ONLY by workflow engine
 */
export async function onConsultationTransition(state, workflow, ctx) {
  if (state !== "COMPLETED") return;

  const {
    appointmentId,
    doctorId,
    patientId,
    hospitalId,
    diagnosis,
    labTests = [],
    medications = [],
    billingItems = [],
  } = ctx;

  /* ================= SAFETY ================= */
  const encounter = await Encounter.findOne({
    appointment: appointmentId,
    hospital: hospitalId,
  });

  if (!encounter) throw new Error("Encounter not found");

  /* ================= DIAGNOSIS ================= */
  const dx = await Diagnosis.create({
    appointment: appointmentId,
    doctor: doctorId,
    patient: patientId,
    hospital: hospitalId,
    diagnosis,
    $locals: { viaWorkflow: true },
  });

  /* ================= LAB ORDERS ================= */
  const labOrders = await Promise.all(
    labTests.map((test) =>
      LabOrder.create({
        test,
        patient: patientId,
        hospital: hospitalId,
        orderedBy: doctorId,
        status: "Pending",
        $locals: { viaWorkflow: true },
      })
    )
  );

  /* ================= PRESCRIPTION ================= */
  const prescription = await Prescription.create({
    patient: patientId,
    doctor: doctorId,
    hospital: hospitalId,
    medications,
    status: "Pending",
    $locals: { viaWorkflow: true },
  });

  /* ================= BILLING ================= */
  const invoice = await Invoice.create({
    patient: patientId,
    hospital: hospitalId,
    items: billingItems,
    source: "Consultation",
    status: "Unpaid",
    $locals: { viaWorkflow: true },
  });

  /* ================= LINK ENCOUNTER ================= */
  encounter.$locals = { viaWorkflow: true };
  encounter.diagnosis = dx._id;
  encounter.labOrders.push(...labOrders.map(l => l._id));
  encounter.prescription = prescription._id;
  encounter.invoice = invoice._id;
  encounter.closedAt = new Date();
  encounter.state = "CLOSED";

  await encounter.save();

  /* ================= NOTIFY ================= */
  await notify(patientId, "Consultation completed");

  /* ================= AUDIT ================= */
  await logAudit({
    actorId: doctorId,
    actorRole: "Doctor",
    action: "CONSULTATION_COMPLETED",
    resource: "consultation",
    resourceId: appointmentId,
    hospital: hospitalId,
    after: {
      diagnosis: dx._id,
      labs: labOrders.length,
      prescription: prescription._id,
      invoice: invoice._id,
    },
  });
}
