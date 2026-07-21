import { createDomainHook } from "./createDomainHook";
import pharmacyService from "../services/pharmacy";

export const usePharmacyAdmin = createDomainHook({
  service: pharmacyService,
  resourceKey: "pharmacy-admin",
  fetcher: async (params = {}) => pharmacyService.listItems?.(params),
  initialData: { items: [], total: 0 },
  watchKeys: [],
  mutations: {
    createItem: { name: "createItem", invalidate: true },
    updateItem: { name: "updateItem", invalidate: true },
    deleteItem: { name: "deleteItem", invalidate: true },
    addStock: { name: "addStock", invalidate: true },
    dispenseStock: { name: "dispenseStock", invalidate: true },
  },
});

export default usePharmacyAdmin;
