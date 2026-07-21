import * as encounterService from "../services/encounter";
import { createDomainHook } from "./createDomainHook";

export const useEncounter = createDomainHook({
  service: encounterService,
  resourceKey: "encounter",
  fetcher: async (patientId) => {
    if (!patientId) return null;
    return encounterService.getLatestEncounterForPatient(patientId);
  },
  initialData: null,
  watchKeys: [],
  mutations: {
    closeEncounter: { name: "close", invalidate: true },
    applyCloseoutEffects: { name: "applyCloseoutEffects", invalidate: true },
    createBillingHandoff: { name: "createBillingHandoff", invalidate: true },
    resolveNurseEscalation: { name: "resolveNurseEscalation", invalidate: true },
  },
  mapResult: (value) => value,
});
