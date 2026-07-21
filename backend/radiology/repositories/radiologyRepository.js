import RadiologyStudy from '../../models/RadiologyStudy.js';
import mongoose from 'mongoose';

export async function createRadiologyRecord({ encounterId, patient, hospital, studyType, notes, metadata = {} }) {
  const study = new RadiologyStudy({
    encounter: encounterId || new mongoose.Types.ObjectId(),
    patient,
    hospital,
    studyType,
    status: 'Pending',
    metadata: { ...metadata, notes: notes || '' },
  });
  study.$locals = { ...(study.$locals || {}), viaWorkflow: true };
  await study.save();
  return study;
}

export async function updateRadiologyRecord(studyId, updates) {
  const study = await RadiologyStudy.findById(studyId);
  if (!study) throw new Error('Radiology study not found');
  Object.assign(study, updates);
  study.$locals = { ...(study.$locals || {}), viaWorkflow: true };
  await study.save();
  return study;
}

export async function findRadiologyRecord(studyId) {
  return RadiologyStudy.findById(studyId).lean();
}
