import * as queries from "./queries.js";
import * as commands from "./commands.js";
import cache from "./cache.js";
import { workflowEvents, WORKFLOW_EVENTS } from "./events.js";
import { workflowPermissions } from "./permissions.js";
import { workflowRuntime } from "./runtime.js";

/**
 * Workflow Domain Manifest
 * Orchestration domain that coordinates actions across multiple clinical domains.
 * Declares dependencies on Encounter, Laboratory, Radiology, and Pharmacy.
 */
export default {
  // Identity
  name: "workflow",
  title: "Workflow",
  version: "1.0.0",
  owner: "Operations",
  description: "Cross-domain workflow orchestration and coordination",
  route: "/app/operations/workflows/index",
  workspace: "operations",
  category: "operations",
  enabled: true,

  // Dependencies and capabilities
  // Workflow orchestrates these domains by listening to their events and issuing commands
  dependsOn: ["encounter", "laboratory", "radiology", "pharmacy", "billing"],
  capabilities: {
    query: true,
    commands: true,
    realtime: true, // Workflow needs real-time event coordination
    events: true,
    permissions: true,
    cache: true,
    search: false,
    orchestration: true, // NEW: marks this as an orchestration domain
  },

  // Health check
  healthCheck: async (service) => {
    try {
      await service.listWorkflows({ limit: 1 });
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
  events: workflowEvents,
  eventTypes: WORKFLOW_EVENTS,
  permissions: workflowPermissions,
  runtime: workflowRuntime,
};
