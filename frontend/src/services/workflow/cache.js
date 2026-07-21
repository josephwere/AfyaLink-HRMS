import { invalidateResourceCachePattern } from "../shared/resourceCache.js";

/**
 * Workflow Domain Cache
 * Cache invalidation rules for workflow queries and commands.
 */

export const workflowCache = {
  invalidateWorkflows() {
    invalidateResourceCachePattern("^workflow:list");
  },
  invalidateWorkflow(id) {
    invalidateResourceCachePattern(`^workflow:(get|status|steps):`);
  },
  invalidateDefinitions() {
    invalidateResourceCachePattern("^workflow:definitions");
  },
  invalidateAll() {
    invalidateResourceCachePattern("^workflow:");
  },
};

export default workflowCache;
