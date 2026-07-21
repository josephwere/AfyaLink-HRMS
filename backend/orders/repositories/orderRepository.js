import mongoose from 'mongoose';
import LabOrder from '../../models/LabOrder.js';

export async function createOrderRecord({ patientId, hospitalId, type, testName, notes, metadata = {} }) {
  const order = new LabOrder({
    encounter: new mongoose.Types.ObjectId(),
    patient: patientId,
    hospital: hospitalId,
    testName,
    status: 'Pending',
    metadata: {
      ...metadata,
      type,
      notes: notes || '',
    },
  });
  order.$locals = { ...(order.$locals || {}), viaWorkflow: true };
  await order.save();
  return order;
}

export async function updateOrderRecord(orderId, updates) {
  const order = await LabOrder.findById(orderId);
  if (!order) throw new Error('Order not found');
  Object.assign(order, updates);
  order.$locals = { ...(order.$locals || {}), viaWorkflow: true };
  await order.save();
  return order;
}

export async function findOrderRecord(orderId) {
  return LabOrder.findById(orderId).lean();
}
