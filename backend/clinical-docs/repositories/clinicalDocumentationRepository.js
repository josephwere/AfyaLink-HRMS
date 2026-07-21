import ClinicalDraft from '../../models/ClinicalDraft.js';
import Encounter from '../../models/Encounter.js';

export async function getClinicalDraftRecord({ hospitalId, patientId, authorId, draftType }) {
  return ClinicalDraft.findOne({
    hospital: hospitalId,
    patient: patientId,
    author: authorId,
    draftType,
  }).lean();
}

export async function upsertClinicalDraftRecord({ hospitalId, patientId, authorId, draftType, payload }) {
  return ClinicalDraft.findOneAndUpdate(
    {
      hospital: hospitalId,
      patient: patientId,
      author: authorId,
      draftType,
    },
    {
      $set: {
        payload,
        hospital: hospitalId,
        patient: patientId,
        author: authorId,
        draftType,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function ensureEncounterRecord({ appointment, user }) {
  let encounter = await Encounter.findOne({ appointment: appointment._id, hospital: appointment.hospital });
  if (encounter) return encounter;

  encounter = new Encounter({
    patient: appointment.patient,
    doctor: appointment.doctor || user._id,
    hospital: appointment.hospital,
    appointment: appointment._id,
    state: 'CREATED',
  });
  encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
  await encounter.save();
  return encounter;
}

export async function applyClinicalDocumentationToEncounter(encounter, { type, payload }) {
  const summaryBits = [];

  if (type === 'OPD_CONSULTATION') {
    if (payload.symptoms) summaryBits.push(`Symptoms: ${String(payload.symptoms).trim()}`);
    if (payload.assessment) summaryBits.push(`Assessment: ${String(payload.assessment).trim()}`);
    if (payload.treatmentPlan) summaryBits.push(`Treatment: ${String(payload.treatmentPlan).trim()}`);
    if (payload.followUp) summaryBits.push(`Follow-up: ${String(payload.followUp).trim()}`);
    encounter.consultationNotes = summaryBits.join('\n') || encounter.consultationNotes || '';
    if (payload.diagnosis) encounter.diagnosis = String(payload.diagnosis).trim();
    if (encounter.state === 'CREATED') encounter.state = 'CONSULTING';
  } else {
    const noteParts = [String(payload.summary || '').trim(), String(payload.note || '').trim()].filter(Boolean);
    if (noteParts.length) encounter.consultationNotes = noteParts.join('\n\n');
    if (encounter.state === 'CREATED') encounter.state = 'CONSULTING';
  }

  encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
  await encounter.save();
  return encounter;
}
