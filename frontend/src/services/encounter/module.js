import manifest from "./manifest.js";
import service from "./service.js";
import { encounterPermissions } from "./permissions.js";
import { encounterRuntime } from "./runtime.js";
import { encounterEvents, ENCOUNTER_EVENTS } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./mutations.js";
import { useEncounter } from "../../hooks/useEncounter";

export const domainModule = {
  manifest,
  service,
  runtime: encounterRuntime,
  permissions: encounterPermissions,
  cache,
  events: encounterEvents,
  eventTypes: ENCOUNTER_EVENTS,
  queries,
  commands,
  register: () => ({
    name: "encounter",
    service,
    hook: useEncounter,
    permissions: ["admin", "doctor", "nurse", "clinical-admin"],
    icon: "calendar",
  }),
};

export default domainModule;
