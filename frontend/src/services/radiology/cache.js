import { invalidateResourceCachePattern } from "../shared/resourceCache.js";

/**
 * Radiology Domain Cache
 * Cache invalidation rules for radiology queries and commands.
 */

export const radiologyCache = {
  invalidateStudies() {
    invalidateResourceCachePattern("^radiology:list");
  },
  invalidateStudy(id) {
    invalidateResourceCachePattern(`^radiology:(get|study|images|report):`);
  },
  invalidateAll() {
    invalidateResourceCachePattern("^radiology:");
  },
};

export default radiologyCache;
