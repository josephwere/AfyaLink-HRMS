import * as queries from "./queries.js";
import * as commands from "./commands.js";
import cache from "./cache.js";
import { billingEvents, BILLING_EVENTS } from "./events.js";
import { billingPermissions } from "./permissions.js";
import { billingRuntime } from "./runtime.js";

export default {
  name: "billing",
  title: "Billing",
  version: "1.0.0",
  owner: "Revenue Cycle",
  description: "Billing, invoice, and payment management",
  route: "/app/revenue/billing/index",
  workspace: "revenue",
  category: "revenue",
  enabled: true,

  dependsOn: ["encounter"],
  capabilities: {
    query: true,
    commands: true,
    realtime: false,
    events: true,
    permissions: true,
    cache: true,
    search: false,
  },

  healthCheck: async (service) => {
    try {
      await service.listInvoices({ limit: 1 });
      return {
        status: "healthy",
        timestamp: Date.now(),
        checks: {
          queryEnabled: true,
          cacheOperational: true,
        },
      };
    } catch (err) {
      return {
        status: "unhealthy",
        timestamp: Date.now(),
        error: err.message,
        checks: {
          queryEnabled: false,
          cacheOperational: false,
        },
      };
    }
  },

  queries,
  commands,
  cache,
  events: billingEvents,
  eventTypes: BILLING_EVENTS,
  permissions: billingPermissions,
  runtime: billingRuntime,
};
