import {
  listInvoices,
  getInvoice,
  getInvoiceSummary,
  listFinancials,
} from "./queries";
import {
  createInvoice,
  finalizeInvoice,
  voidInvoice,
  createPayment,
  createFinancial,
  payFinancial,
  claimFinancial,
} from "./commands";

export * from "./queries";
export * from "./commands";
export { default as billingService } from "./service";
export { billingCache } from "./cache";
export { billingEvents, BILLING_EVENTS } from "./events";
export { billingPermissions, checkPermission } from "./permissions";
export { billingRuntime } from "./runtime";

export { listInvoices as list, getInvoice as get, getInvoiceSummary as getSummary, listFinancials as listFinancial } from "./queries";
export {
  createInvoice as create,
  finalizeInvoice as finalize,
  voidInvoice as voidInvoiceAction,
  createPayment as createPaymentAction,
  createFinancial as createFinancialAction,
  payFinancial as payFinancialAction,
  claimFinancial as claimFinancialAction,
} from "./commands";

export default {
  list: listInvoices,
  get: getInvoice,
  getSummary: getInvoiceSummary,
  create: createInvoice,
  finalize: finalizeInvoice,
  voidInvoice,
  createPayment,
  listFinancials,
  createFinancial,
  payFinancial,
  claimFinancial,
};
