import mongoose from 'mongoose';
import Encounter from '../../models/Encounter.js';
import { ENCOUNTER_STATES } from '../runtime/encounterStateMachine.js';

export async function createEncounterRecord(input) {
  const doc = new Encounter({
    ...input,
    state: input.state || ENCOUNTER_STATES.CREATED,
  });
  doc.$locals = { ...(doc.$locals || {}), viaWorkflow: true };
  await doc.save();
  return doc.toObject();
}

export async function updateEncounterRecord(id, update) {
  const doc = await Encounter.findById(id);
  if (!doc) return null;
  Object.assign(doc, update);
  doc.$locals = { ...(doc.$locals || {}), viaWorkflow: true };
  await doc.save();
  return doc.toObject();
}

export async function getEncounterRecord(id) {
  const doc = await Encounter.findById(id).lean();
  return doc;
}

export async function listEncounterRecords(filter = {}, options = {}) {
  const query = Encounter.find(filter).sort({ createdAt: -1, _id: -1 });
  if (options.limit) query.limit(options.limit);
  return query.lean();
}

export const encounterRepository = {
  async save(encounter) {
    if (!encounter?.id) return null;
    if (mongoose.connection?.readyState !== 1) return null;

    try {
      const payload = {
        patient: encounter.patientId,
        doctor: encounter.doctorId,
        hospital: encounter.hospitalId,
        state: encounter.state,
        consultationNotes: encounter.metadata?.consultationNotes || undefined,
        diagnosis: encounter.metadata?.diagnosis || undefined,
      };

      const existing = await Encounter.findOne({ _id: encounter.id });
      if (existing) {
        Object.assign(existing, payload);
        existing.$locals = { ...(existing.$locals || {}), viaWorkflow: true };
        await existing.save();
        return existing.toObject();
      }

      const created = new Encounter(payload);
      created._id = encounter.id;
      created.$locals = { ...(created.$locals || {}), viaWorkflow: true };
      await created.save();
      return created.toObject();
    } catch (error) {
      return null;
    }
  },
};
