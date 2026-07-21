import { ordersRuntime } from '../orders/runtime/ordersRuntime.js';

export async function createOrder(req, res) {
  try {
    const item = await ordersRuntime.createOrder({
      patientId: req.body?.patientId,
      hospitalId: req.body?.hospitalId || req.user?.hospital,
      type: req.body?.type,
      testName: req.body?.testName,
      notes: req.body?.notes,
      metadata: req.body?.metadata,
    });
    return res.status(201).json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to create order' });
  }
}

export async function transitionOrder(req, res) {
  try {
    const item = await ordersRuntime.transitionOrder(req.params.id, {
      to: req.body?.to,
      result: req.body?.result,
      notes: req.body?.notes,
    });
    return res.json({ item });
  } catch (err) {
    const status = err.code === 409 ? 409 : 400;
    return res.status(status).json({ message: err.message || 'Failed to transition order' });
  }
}

export async function cancelOrder(req, res) {
  try {
    const item = await ordersRuntime.cancelOrder(req.params.id, { notes: req.body?.notes });
    return res.json({ item });
  } catch (err) {
    const status = err.code === 409 ? 409 : 400;
    return res.status(status).json({ message: err.message || 'Failed to cancel order' });
  }
}
