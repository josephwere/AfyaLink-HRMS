import manifest from "./manifest.js";
import service from "./service.js";
import { pharmacyPermissions } from "./permissions.js";
import { pharmacyRuntime } from "./runtime.js";
import { pharmacyEvents } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./commands.js";
import { usePharmacy } from "../../hooks/usePharmacy";

export const domainModule = {
  manifest,
  service,
  runtime: pharmacyRuntime,
  permissions: pharmacyPermissions,
  cache,
  events: pharmacyEvents,
  queries,
  commands,
  register: () => ({
    name: "pharmacy",
    service,
    hook: usePharmacy,
    permissions: ["admin", "pharmacist", "doctor", "nurse"],
    icon: "pill",
  }),
};

export default domainModule;
