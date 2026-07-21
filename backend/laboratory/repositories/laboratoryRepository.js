import LabOrder from '../../models/LabOrder.js';
import mongoose from 'mongoose';

export async function createLaboratoryRecord({ encounterId, patient, hospital, testName, notes, metadata = {} }) {
  const order = new LabOrder({
    encounter: encounterId || new mongoose.Types.ObjectId(),
    patient,
    hospital,
    testName,
    status: 'Pending',
    metadata: { ...metadata, notes: notes || '' },
  });
  order.$locals = { ...(order.$locals || {}), viaWorkflow: true };
  await order.save();
  return order;
}

export async function updateLaboratoryRecord(orderId, updates) {
  const order = await LabOrder.findById(orderId);
  if (!order) throw new Error('Lab order not found');
  Object.assign(order, updates);
  order.$locals = { ...(order.$locals || {}), viaWorkflow: true };
  await order.save();
  return order;
}

export async function findLaboratoryRecord(orderId) {
  return LabOrder.findById(orderId).lean();
}
