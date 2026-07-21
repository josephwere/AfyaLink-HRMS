import { invalidateResourceCachePattern } from "../shared/resourceCache.js";

/**
 * Laboratory Domain Cache
 * Cache invalidation rules for laboratory queries and commands.
 */

export const laboratoryCache = {
  invalidateTests() {
    invalidateResourceCachePattern("^laboratory:list");
  },
  invalidateTest(id) {
    invalidateResourceCachePattern(`^laboratory:(get|test|results):`);
  },
  invalidateSamples() {
    invalidateResourceCachePattern("^laboratory:samples");
  },
  invalidateSample(id) {
    invalidateResourceCachePattern(`^laboratory:(sample|results):`);
  },
  invalidateAll() {
    invalidateResourceCachePattern("^laboratory:");
  },
};

export default laboratoryCache;
