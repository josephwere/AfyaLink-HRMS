import * as queries from "./queries.js";
import * as commands from "./commands.js";
import cache from "./cache.js";
import { laboratoryEvents, LABORATORY_EVENTS } from "./events.js";
import { laboratoryPermissions } from "./permissions.js";
import { laboratoryRuntime } from "./runtime.js";

/**
 * Laboratory Domain Manifest
 * Single source of truth for all laboratory domain metadata, queries, commands, and contracts.
 */
export default {
  // Identity
  name: "laboratory",
  title: "Laboratory",
  version: "1.0.0",
  owner: "Pathology",
  description: "Laboratory test management, sample handling, and results workflow",
  route: "/app/operations/lab/test-queue",
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
      await service.listTests({ limit: 1 });
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
  events: laboratoryEvents,
  eventTypes: LABORATORY_EVENTS, // Export event type constants
  permissions: laboratoryPermissions,
  runtime: laboratoryRuntime,
};
