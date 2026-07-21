import * as queries from "./queries.js";
import * as commands from "./commands.js";
import cache from "./cache.js";
import { radiologyEvents, RADIOLOGY_EVENTS } from "./events.js";
import { radiologyPermissions } from "./permissions.js";
import { radiologyRuntime } from "./runtime.js";

/**
 * Radiology Domain Manifest
 * Single source of truth for all radiology domain metadata, queries, commands, and contracts.
 */
export default {
  // Identity
  name: "radiology",
  title: "Radiology",
  version: "1.0.0",
  owner: "Imaging",
  description: "Radiology studies, imaging, and reporting workflow",
  route: "/app/operations/radiology/index",
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
      await service.listStudies({ limit: 1 });
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
  events: radiologyEvents,
  eventTypes: RADIOLOGY_EVENTS,
  permissions: radiologyPermissions,
  runtime: radiologyRuntime,
};
