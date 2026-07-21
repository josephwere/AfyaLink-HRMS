import workflowService from "./service.js";

/**
 * Workflow Domain Module
 * Provides complete workflow domain interface for orchestration.
 */
export default workflowService;

// Re-export all domain components for explicit usage
export { default as service } from "./service.js";
export * as queries from "./queries.js";
export * as commands from "./commands.js";
export { default as cache } from "./cache.js";
export { workflowEvents, WORKFLOW_EVENTS } from "./events.js";
export { workflowPermissions, checkPermission } from "./permissions.js";
export { workflowRuntime } from "./runtime.js";
export { default as manifest } from "./manifest.js";
