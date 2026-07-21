import * as queries from "./queries.js";
import * as commands from "./commands.js";
import cache from "./cache.js";
import { pharmacyEvents } from "./events.js";
import { pharmacyPermissions } from "./permissions.js";
import { pharmacyRuntime } from "./runtime.js";

/**
 * Pharmacy Domain Manifest
 * Single source of truth for all pharmacy domain metadata, queries, commands, and contracts.
 */
export default {
  // Identity
  name: "pharmacy",
  title: "Pharmacy",
  version: "1.0.0",
  owner: "Clinical Operations",
  description: "Pharmacy inventory and dispensing management",
  route: "/app/operations/pharmacy/inventory",
  workspace: "operations",
  category: "operations",
  enabled: true,

  // Dependencies and capabilities
  dependsOn: ["encounter"],
  capabilities: {
    query: true,
    commands: true,
    realtime: false,
    events: true,
    permissions: true,
    cache: true,
    search: true,
  },

  // Health check
  healthCheck: async (service) => {
    try {
      // Quick query to verify service is operational
      await service.listItems({ limit: 1 });
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

  // Domain contracts
  queries,
  commands,
  cache,
  events: pharmacyEvents,
  permissions: pharmacyPermissions,
  runtime: pharmacyRuntime,
};
