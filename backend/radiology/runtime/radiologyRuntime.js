import { createRadiologyRecord, updateRadiologyRecord, findRadiologyRecord } from '../repositories/radiologyRepository.js';
import { canTransitionRadiology, RADIOLOGY_STATES } from './radiologyStateMachine.js';
import { emitOperationalEvent } from '../../services/operationalEventGateway.js';

function normalizeRadiologyState(value) {
  const normalized = String(value || '').trim().toUpperCase();
  switch (normalized) {
    case 'COMPLETED':
    case 'DONE':
      return RADIOLOGY_STATES.COMPLETED;
    case 'CANCELLED':
    case 'CANCELED':
      return RADIOLOGY_STATES.CANCELLED;
    default:
      return RADIOLOGY_STATES.PENDING;
  }
}

export function createRadiologyRuntime() {
  return {
    async createStudy({ encounterId, patient, hospital, studyType, notes, metadata }) {
      const item = await createRadiologyRecord({ encounterId, patient, hospital, studyType, notes, metadata });
      await emitOperationalEvent({
        type: 'RADIOLOGY_STUDY_CREATED',
        source: 'radiology-runtime',
        hospitalId: hospital,
        entity: 'RadiologyStudy',
        payload: { studyId: String(item._id), patientId: String(patient), studyType },
      });
      return item;
    },

    async transitionStudy(studyId, { to, result, notes }) {
      const study = await findRadiologyRecord(studyId);
      if (!study) throw new Error('Radiology study not found');
      const normalizedTo = normalizeRadiologyState(to);
      if (!canTransitionRadiology(study.status, normalizedTo)) {
        throw new Error(`Cannot transition from ${study.status} to ${normalizedTo}`);
      }
      const next = await updateRadiologyRecord(studyId, {
        status: normalizedTo,
        result: result || study.result,
        completedAt: normalizedTo === RADIOLOGY_STATES.COMPLETED ? new Date() : study.completedAt,
        metadata: {
          ...(study.metadata || {}),
          lastEvent: normalizedTo === RADIOLOGY_STATES.COMPLETED ? 'RADIOLOGY_STUDY_COMPLETED' : 'RADIOLOGY_STUDY_CANCELLED',
          notes: notes || study.metadata?.notes || '',
        },
      });
      await emitOperationalEvent({
        type: normalizedTo === RADIOLOGY_STATES.COMPLETED ? 'RADIOLOGY_STUDY_COMPLETED' : 'RADIOLOGY_STUDY_CANCELLED',
        source: 'radiology-runtime',
        hospitalId: study.hospital,
        entity: 'RadiologyStudy',
        payload: { studyId: String(studyId), patientId: String(study.patient), status: normalizedTo },
      });
      return next;
    },
  };
}

export const radiologyRuntime = createRadiologyRuntime();
