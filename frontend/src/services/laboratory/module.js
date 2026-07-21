import manifest from "./manifest.js";
import service from "./service.js";
import { laboratoryPermissions } from "./permissions.js";
import { laboratoryRuntime } from "./runtime.js";
import { laboratoryEvents, LABORATORY_EVENTS } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./commands.js";
import { useLaboratory } from "../../hooks/useLaboratory";

export const domainModule = {
  manifest,
  service,
  runtime: laboratoryRuntime,
  permissions: laboratoryPermissions,
  cache,
  events: laboratoryEvents,
  eventTypes: LABORATORY_EVENTS,
  queries,
  commands,
  register: () => ({
    name: "laboratory",
    service,
    hook: useLaboratory,
    permissions: ["admin", "lab-tech", "pathologist", "doctor"],
    icon: "beaker",
    workspace: "operations",
  }),
};

export default domainModule;
