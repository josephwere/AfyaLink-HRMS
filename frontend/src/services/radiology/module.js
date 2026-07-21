import manifest from "./manifest.js";
import service from "./service.js";
import { radiologyPermissions } from "./permissions.js";
import { radiologyRuntime } from "./runtime.js";
import { radiologyEvents, RADIOLOGY_EVENTS } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./commands.js";
import { useRadiology } from "../../hooks/useRadiology";

export const domainModule = {
  manifest,
  service,
  runtime: radiologyRuntime,
  permissions: radiologyPermissions,
  cache,
  events: radiologyEvents,
  eventTypes: RADIOLOGY_EVENTS,
  queries,
  commands,
  register: () => ({
    name: "radiology",
    service,
    hook: useRadiology,
    permissions: ["admin", "radiologist", "radiologic-technologist", "doctor"],
    icon: "x-ray",
    workspace: "operations",
  }),
};

export default domainModule;
