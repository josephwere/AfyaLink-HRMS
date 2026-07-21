import { createLaboratoryRecord, updateLaboratoryRecord, findLaboratoryRecord } from '../repositories/laboratoryRepository.js';
import { canTransitionLaboratory, LABORATORY_STATES } from './laboratoryStateMachine.js';
import { emitOperationalEvent } from '../../services/operationalEventGateway.js';

function normalizeLaboratoryState(value) {
  const normalized = String(value || '').trim().toUpperCase();
  switch (normalized) {
    case 'COMPLETED':
    case 'DONE':
      return LABORATORY_STATES.COMPLETED;
    case 'CANCELLED':
    case 'CANCELED':
      return LABORATORY_STATES.CANCELLED;
    default:
      return LABORATORY_STATES.PENDING;
  }
}

export function createLaboratoryRuntime() {
  return {
    async createOrder({ encounterId, patient, hospital, testName, notes, metadata }) {
      const item = await createLaboratoryRecord({ encounterId, patient, hospital, testName, notes, metadata });
      await emitOperationalEvent({
        type: 'LAB_ORDER_CREATED',
        source: 'laboratory-runtime',
        hospitalId: hospital,
        entity: 'LabOrder',
        payload: { orderId: String(item._id), patientId: String(patient), testName },
      });
      return item;
    },

    async transitionOrder(orderId, { to, result, notes }) {
      const order = await findLaboratoryRecord(orderId);
      if (!order) throw new Error('Lab order not found');
      const normalizedTo = normalizeLaboratoryState(to);
      if (!canTransitionLaboratory(order.status, normalizedTo)) {
        throw new Error(`Cannot transition from ${order.status} to ${normalizedTo}`);
      }
      const next = await updateLaboratoryRecord(orderId, {
        status: normalizedTo,
        result: result || order.result,
        completedAt: normalizedTo === LABORATORY_STATES.COMPLETED ? new Date() : order.completedAt,
        metadata: { ...(order.metadata || {}), lastEvent: normalizedTo === LABORATORY_STATES.COMPLETED ? 'LAB_ORDER_COMPLETED' : 'LAB_ORDER_CANCELLED', notes: notes || order.metadata?.notes || '' },
      });
      await emitOperationalEvent({
        type: normalizedTo === LABORATORY_STATES.COMPLETED ? 'LAB_ORDER_COMPLETED' : 'LAB_ORDER_CANCELLED',
        source: 'laboratory-runtime',
        hospitalId: order.hospital,
        entity: 'LabOrder',
        payload: { orderId: String(orderId), patientId: String(order.patient), status: normalizedTo },
      });
      return next;
    },
  };
}

export const laboratoryRuntime = createLaboratoryRuntime();
