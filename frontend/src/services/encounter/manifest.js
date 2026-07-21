import * as queries from "./queries.js";
import * as commands from "./mutations.js";
import cache from "./cache.js";
import { encounterEvents, ENCOUNTER_EVENTS } from "./events.js";
import { encounterPermissions } from "./permissions.js";
import { encounterRuntime } from "./runtime.js";

/**
 * Encounter Domain Manifest
 * Single source of truth for all encounter domain metadata, queries, commands, and contracts.
 */
export default {
  // Identity
  name: "encounter",
  title: "Encounter",
  version: "2.1.0",
  owner: "Clinical",
  description: "Patient encounter lifecycle and workflow management",
  route: "/app/care/encounters/opd",
  workspace: "care",
  category: "clinical",
  enabled: true,

  // Dependencies and capabilities
  dependsOn: [],
  capabilities: {
    query: true,
    commands: true,
    realtime: false,
    events: true,
    permissions: true,
    cache: true,
    search: false,
  },

  // Health check
  healthCheck: async (service) => {
    try {
      // Quick query to verify service is operational
      await service.listEncounters({ limit: 1 });
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
  events: encounterEvents,
  eventTypes: ENCOUNTER_EVENTS, // Export event type constants
  permissions: encounterPermissions,
  runtime: encounterRuntime,
};
