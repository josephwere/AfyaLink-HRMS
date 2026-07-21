export * from "./queries";
export * from "./mutations";
export { default as encounterService } from "./service";
export { encounterCache } from "./cache";
export { encounterEvents, ENCOUNTER_EVENTS } from "./events";
export { encounterPermissions, checkPermission } from "./permissions";
export { encounterRuntime } from "./runtime";

export { listEncounters as list, getLatestEncounterForPatient as getLatestForPatient } from "./queries";
export {
  createEncounter as create,
  closeEncounter as close,
  applyCloseoutEffects,
  createBillingHandoff,
  resolveNurseEscalation,
} from "./mutations";

// backward compatibility
import { listEncounters, getLatestEncounterForPatient } from "./queries";
import { createEncounter, closeEncounter, applyCloseoutEffects, createBillingHandoff, resolveNurseEscalation } from "./mutations";

export default {
  list: listEncounters,
  getLatestForPatient: getLatestEncounterForPatient,
  create: createEncounter,
  close: closeEncounter,
  applyCloseoutEffects,
  createBillingHandoff,
  resolveNurseEscalation,
};
