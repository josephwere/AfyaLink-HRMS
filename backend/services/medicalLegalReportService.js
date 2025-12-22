import Encounter from "../models/Encounter.js";
import Workflow from "../models/Workflow.js";

export async function generateMedicalLegalReport(encounterId) {
  const encounter = await Encounter.findById(encounterId)
    .populate("patient doctor");

  const workflow = await Workflow.findOne({ encounter: encounterId });

  return {
    patient: encounter.patient,
    doctor: encounter.doctor,
    encounterDate: encounter.createdAt,
    diagnosis: encounter.diagnosis,
    procedures: encounter.procedures,
    medications: encounter.prescriptions,
    workflowTimeline: workflow.history,
  };
}
