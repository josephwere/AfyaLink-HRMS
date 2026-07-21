import {
  createPrescriptionRecord,
  updatePrescriptionRecord,
  findPrescriptionRecord,
} from '../repositories/prescriptionRepository.js';
import { canTransitionPrescription, PRESCRIPTION_STATES } from './prescriptionStateMachine.js';
import { emitOperationalEvent } from '../../services/operationalEventGateway.js';

function normalizePrescriptionState(value) {
  const normalized = String(value || '').trim().toUpperCase();
  switch (normalized) {
    case 'DISPENSED':
      return PRESCRIPTION_STATES.DISPENSED;
    case 'CANCELLED':
    case 'CANCELED':
      return PRESCRIPTION_STATES.CANCELLED;
    default:
      return PRESCRIPTION_STATES.CREATED;
  }
}

export function createPrescriptionRuntime() {
  return {
    async createPrescription({ encounterId, appointmentId, patient, patientRecord, doctor, hospital, medications, summary, advice }) {
      const item = await createPrescriptionRecord({
        encounterId,
        appointmentId,
        patient,
        patientRecord,
        doctor,
        hospital,
        medications,
        summary,
        advice,
      });
      await emitOperationalEvent({
        type: 'PRESCRIPTION_CREATED',
        source: 'prescription-runtime',
        hospitalId: hospital,
        entity: 'Prescription',
        payload: { prescriptionId: String(item._id), patientId: String(patient), appointmentId: String(appointmentId || '') },
      });
      return item;
    },

    async transitionPrescription(prescriptionId, { to, dispensedBy, dispensedAt }) {
      const prescription = await findPrescriptionRecord(prescriptionId);
      if (!prescription) throw new Error('Prescription not found');
      const normalizedTo = normalizePrescriptionState(to);
      if (!canTransitionPrescription(prescription.status, normalizedTo)) {
        throw new Error(`Cannot transition from ${prescription.status} to ${normalizedTo}`);
      }
      const next = await updatePrescriptionRecord(prescriptionId, {
        status: normalizedTo,
        dispensedBy: normalizedTo === PRESCRIPTION_STATES.DISPENSED ? dispensedBy : null,
        dispensedAt: normalizedTo === PRESCRIPTION_STATES.DISPENSED ? (dispensedAt || new Date()) : null,
      });
      await emitOperationalEvent({
        type: normalizedTo === PRESCRIPTION_STATES.DISPENSED ? 'PRESCRIPTION_DISPENSED' : 'PRESCRIPTION_CANCELLED',
        source: 'prescription-runtime',
        hospitalId: prescription.hospital,
        entity: 'Prescription',
        payload: { prescriptionId: String(prescriptionId), patientId: String(prescription.patient), status: normalizedTo },
      });
      return next;
    },
  };
}

export const prescriptionRuntime = createPrescriptionRuntime();
