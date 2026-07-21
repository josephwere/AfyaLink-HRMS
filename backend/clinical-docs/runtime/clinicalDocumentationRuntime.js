import {
  getClinicalDraftRecord,
  upsertClinicalDraftRecord,
  ensureEncounterRecord,
  applyClinicalDocumentationToEncounter,
} from '../repositories/clinicalDocumentationRepository.js';

export function createClinicalDocumentationRuntime() {
  return {
    async getDraft({ hospitalId, patientId, authorId, draftType }) {
      return getClinicalDraftRecord({ hospitalId, patientId, authorId, draftType });
    },

    async saveDraft({ hospitalId, patientId, authorId, draftType, payload }) {
      return upsertClinicalDraftRecord({ hospitalId, patientId, authorId, draftType, payload });
    },

    async promoteDraft({ appointment, user, type, payload }) {
      const encounter = await ensureEncounterRecord({ appointment, user });
      await applyClinicalDocumentationToEncounter(encounter, { type, payload });
      return encounter;
    },
  };
}

export const clinicalDocumentationRuntime = createClinicalDocumentationRuntime();
