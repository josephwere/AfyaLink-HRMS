import { laboratoryRuntime } from '../laboratory/runtime/laboratoryRuntime.js';

export async function createLaboratoryOrder(req, res) {
  try {
    const item = await laboratoryRuntime.createOrder({
      encounterId: req.body?.encounterId || null,
      patient: req.body?.patient,
      hospital: req.body?.hospital || req.user?.hospital,
      testName: req.body?.testName || req.body?.testType,
      notes: req.body?.notes,
      metadata: req.body?.metadata,
    });
    return res.status(201).json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to create lab order' });
  }
}

export async function transitionLaboratoryOrder(req, res) {
  try {
    const item = await laboratoryRuntime.transitionOrder(req.params.id, {
      to: req.body?.to,
      result: req.body?.result,
      notes: req.body?.notes,
    });
    return res.json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to transition lab order' });
  }
}
