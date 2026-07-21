import Prescription from '../../models/Prescription.js';

export async function createPrescriptionRecord({ encounterId, appointmentId, patient, patientRecord, doctor, hospital, medications, summary, advice }) {
  const prescription = new Prescription({
    encounter: encounterId || null,
    appointment: appointmentId || null,
    patient,
    patientRecord,
    doctor,
    hospital,
    medications,
    summary,
    advice,
    status: 'CREATED',
  });
  prescription.$locals = { ...(prescription.$locals || {}), viaWorkflow: true };
  await prescription.save();
  return prescription;
}

export async function updatePrescriptionRecord(prescriptionId, updates) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw new Error('Prescription not found');
  Object.assign(prescription, updates);
  prescription.$locals = { ...(prescription.$locals || {}), viaWorkflow: true };
  await prescription.save();
  return prescription;
}

export async function findPrescriptionRecord(prescriptionId) {
  return Prescription.findById(prescriptionId).lean();
}
