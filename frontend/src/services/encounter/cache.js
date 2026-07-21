import { invalidateResourceCachePattern } from "../shared/resourceCache";

export const encounterCache = {
  invalidateList() {
    invalidateResourceCachePattern("^encounter:list");
  },
  invalidateEncounter(id) {
    invalidateResourceCachePattern(`^encounter:(get|latest):`);
  },
  invalidateAll() {
    invalidateResourceCachePattern("^encounter:");
  },
};

export default encounterCache;
