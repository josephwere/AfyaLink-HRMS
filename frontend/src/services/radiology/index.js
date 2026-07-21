import radiologyService from "./service.js";

/**
 * Radiology Domain Module
 * Provides complete radiology domain interface including queries, commands, cache, events, permissions.
 */
export default radiologyService;

// Re-export all domain components for explicit usage
export { default as service } from "./service.js";
export * as queries from "./queries.js";
export * as commands from "./commands.js";
export { default as cache } from "./cache.js";
export { radiologyEvents, RADIOLOGY_EVENTS } from "./events.js";
export { radiologyPermissions, checkPermission } from "./permissions.js";
export { radiologyRuntime } from "./runtime.js";
export { default as manifest } from "./manifest.js";
