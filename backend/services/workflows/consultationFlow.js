import Diagnosis from "../../models/Diagnosis.js";
import LabOrder from "../../models/LabOrder.js";
import Prescription from "../../models/Prescription.js";
import Invoice from "../../models/Invoice.js";
import Encounter from "../../models/Encounter.js";
import { notify, notifyRolesInHospital } from "../notificationService.js";
import User from "../../models/User.js";
import Patient from "../../models/Patient.js";
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
  // Notify patient
  await notify({ user: patientId, hospital: hospitalId, title: "Consultation completed", body: "Your consultation has completed.", category: "CLINICAL", meta: { appointmentId } });

  // Notify hospital admins about completed consultation (operational)
    try {
      const doctor = doctorId ? await User.findById(doctorId).select("name").lean() : null;
      const patientDoc = patientId ? await Patient.findById(patientId).select("firstName lastName").lean() : null;
      const doctorName = doctor?.name || "A clinician";
      const patientLabel = patientDoc ? `${patientDoc.firstName || ""} ${patientDoc.lastName || ""}`.trim() : "a patient";
      const title = `${doctorName} completed consultation`;
      const body = `${doctorName} completed consultation for ${patientLabel}.`;
      await notifyRolesInHospital({ hospital: hospitalId, roles: ["HOSPITAL_ADMIN"], title, body, category: "OPERATIONAL", meta: { appointmentId, doctorId, patientId } });
    } catch (err) {
      console.error("Failed to notify hospital admins on consultation completion:", err);
    }

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
