import { invalidateResourceCachePattern } from "../shared/resourceCache";

export const billingCache = {
  invalidateInvoices() {
    invalidateResourceCachePattern("^billing:list");
  },
  invalidateInvoice(id) {
    invalidateResourceCachePattern(`^billing:(list|get):.*`);
  },
  invalidateAll() {
    invalidateResourceCachePattern("^billing:");
  },
};

export default billingCache;
