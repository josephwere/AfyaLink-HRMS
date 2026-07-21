import billingService from "../services/billing";
import { createDomainHook } from "./createDomainHook";

export const useBilling = createDomainHook({
  service: billingService,
  resourceKey: "billing",
  fetcher: async (params) => billingService.listInvoices(params),
  initialData: { invoices: [], total: 0 },
  watchKeys: [],
  mutations: {
    createInvoice: { name: "create", invalidate: true },
    finalizeInvoice: { name: "finalize", invalidate: true },
    voidInvoice: { name: "voidInvoice", invalidate: true },
    createPayment: { name: "createPayment", invalidate: true },
  },
});
