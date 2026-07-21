import { prescriptionRuntime } from '../prescription/runtime/prescriptionRuntime.js';

export async function createPrescriptionRuntimeController(req, res) {
  try {
    const item = await prescriptionRuntime.createPrescription({
      encounterId: req.body?.encounterId || null,
      appointmentId: req.body?.appointmentId || null,
      patient: req.body?.patient,
      patientRecord: req.body?.patientRecord || null,
      doctor: req.body?.doctor || req.user?._id,
      hospital: req.body?.hospital || req.user?.hospital,
      medications: req.body?.medications || [],
      summary: req.body?.summary || '',
      advice: req.body?.advice || '',
    });
    return res.status(201).json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to create prescription' });
  }
}

export async function transitionPrescriptionRuntimeController(req, res) {
  try {
    const item = await prescriptionRuntime.transitionPrescription(req.params.id, {
      to: req.body?.to,
      dispensedBy: req.body?.dispensedBy || req.user?._id,
      dispensedAt: req.body?.dispensedAt,
    });
    return res.json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to transition prescription' });
  }
}
