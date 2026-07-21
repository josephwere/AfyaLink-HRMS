import laboratoryService from "./service.js";

/**
 * Laboratory Domain Module
 * Provides complete laboratory domain interface including queries, commands, cache, events, permissions.
 */
export default laboratoryService;

// Re-export all domain components for explicit usage
export { default as service } from "./service.js";
export * as queries from "./queries.js";
export * as commands from "./commands.js";
export { default as cache } from "./cache.js";
export { laboratoryEvents, LABORATORY_EVENTS } from "./events.js";
export { laboratoryPermissions, checkPermission } from "./permissions.js";
export { laboratoryRuntime } from "./runtime.js";
export { default as manifest } from "./manifest.js";
