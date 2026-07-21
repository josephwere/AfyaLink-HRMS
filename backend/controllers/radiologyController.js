import { radiologyRuntime } from '../radiology/runtime/radiologyRuntime.js';

export async function createRadiologyStudy(req, res) {
  try {
    const item = await radiologyRuntime.createStudy({
      encounterId: req.body?.encounterId || null,
      patient: req.body?.patient,
      hospital: req.body?.hospital || req.user?.hospital,
      studyType: req.body?.studyType || req.body?.testType,
      notes: req.body?.notes,
      metadata: req.body?.metadata,
    });
    return res.status(201).json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to create radiology study' });
  }
}

export async function transitionRadiologyStudy(req, res) {
  try {
    const item = await radiologyRuntime.transitionStudy(req.params.id, {
      to: req.body?.to,
      result: req.body?.result,
      notes: req.body?.notes,
    });
    return res.json({ item });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to transition radiology study' });
  }
}
