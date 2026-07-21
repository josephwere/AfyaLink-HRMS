import { createOrderRecord, updateOrderRecord, findOrderRecord } from '../repositories/orderRepository.js';
import { canTransitionOrder, ORDER_STATES } from './orderStateMachine.js';
import { emitOperationalEvent } from '../../services/operationalEventGateway.js';

function normalizeOrderState(value) {
  if (!value) return ORDER_STATES.PENDING;
  const normalized = String(value).trim().toUpperCase();
  switch (normalized) {
    case 'PENDING':
    case 'OPEN':
      return ORDER_STATES.PENDING;
    case 'COMPLETED':
    case 'DONE':
      return ORDER_STATES.COMPLETED;
    case 'CANCELLED':
    case 'CANCELED':
      return ORDER_STATES.CANCELLED;
    default:
      return ORDER_STATES.PENDING;
  }
}

export function createOrdersRuntime() {
  return {
    async createOrder({ patientId, hospitalId, type, testName, notes, metadata }) {
      const item = await createOrderRecord({ patientId, hospitalId, type, testName, notes, metadata });
      await emitOperationalEvent({
        type: 'ORDER_CREATED',
        source: 'orders-runtime',
        hospitalId,
        entity: 'Order',
        payload: { orderId: String(item._id), patientId: String(patientId), type, testName },
      });
      return item;
    },

    async transitionOrder(orderId, { to, result, notes }) {
      const order = await findOrderRecord(orderId);
      if (!order) throw new Error('Order not found');
      const normalizedTo = normalizeOrderState(to);
      if (!canTransitionOrder(order.status, normalizedTo)) {
        throw new Error(`Cannot transition from ${order.status} to ${normalizedTo}`);
      }

      const next = await updateOrderRecord(orderId, {
        status: normalizedTo,
        result: result || order.result,
        completedAt: normalizedTo === ORDER_STATES.COMPLETED ? new Date() : order.completedAt,
        metadata: {
          ...(order.metadata || {}),
          lastEvent: normalizedTo === ORDER_STATES.COMPLETED ? 'ORDER_COMPLETED' : 'ORDER_CANCELLED',
          notes: notes || order.metadata?.notes || '',
        },
      });
      await emitOperationalEvent({
        type: normalizedTo === ORDER_STATES.COMPLETED ? 'ORDER_COMPLETED' : 'ORDER_CANCELLED',
        source: 'orders-runtime',
        hospitalId: order.hospital,
        entity: 'Order',
        payload: { orderId: String(orderId), patientId: String(order.patient), status: normalizedTo },
      });
      return next;
    },

    async cancelOrder(orderId, { notes } = {}) {
      const order = await findOrderRecord(orderId);
      if (!order) throw new Error('Order not found');
      if (order.status !== ORDER_STATES.PENDING) {
        const err = new Error('Only pending orders can be cancelled');
        err.code = 409;
        throw err;
      }
      const next = await updateOrderRecord(orderId, {
        status: ORDER_STATES.CANCELLED,
        metadata: {
          ...(order.metadata || {}),
          lastEvent: 'ORDER_CANCELLED',
          notes: notes || order.metadata?.notes || '',
        },
      });
      await emitOperationalEvent({
        type: 'ORDER_CANCELLED',
        source: 'orders-runtime',
        hospitalId: order.hospital,
        entity: 'Order',
        payload: { orderId: String(orderId), patientId: String(order.patient), status: ORDER_STATES.CANCELLED },
      });
      return next;
    },
  };
}

export const ordersRuntime = createOrdersRuntime();
