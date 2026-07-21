import manifest from "./manifest.js";
import service from "./service.js";
import { billingPermissions } from "./permissions.js";
import { billingRuntime } from "./runtime.js";
import { billingEvents, BILLING_EVENTS } from "./events.js";
import cache from "./cache.js";
import * as queries from "./queries.js";
import * as commands from "./commands.js";

export const domainModule = {
  manifest,
  service,
  runtime: billingRuntime,
  permissions: billingPermissions,
  cache,
  events: billingEvents,
  eventTypes: BILLING_EVENTS,
  queries,
  commands,
  register: () => ({
    name: "billing",
    service,
    permissions: ["admin", "billing", "cashier", "doctor"],
    icon: "receipt",
  }),
};

export default domainModule;
