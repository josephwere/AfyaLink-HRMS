import { invalidateResourceCachePattern } from "../shared/resourceCache";

export const pharmacyCache = {
  invalidateItems() {
    invalidateResourceCachePattern("^pharmacy:list");
  },
  invalidateItem(id) {
    invalidateResourceCachePattern(`^pharmacy:(list|get):.*`);
  },
  invalidateAll() {
    invalidateResourceCachePattern("^pharmacy:");
  },
};

export default pharmacyCache;
