const listeners = new Map();

export const billingEvents = {
  on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event).push(handler);
  },
  off(event, handler) {
    if (!listeners.has(event)) return;
    const handlers = listeners.get(event);
    const idx = handlers.indexOf(handler);
    if (idx > -1) handlers.splice(idx, 1);
  },
  emit(event, payload) {
    if (!listeners.has(event)) return;
    listeners.get(event).forEach((h) => h(payload));
  },
};

export const BILLING_EVENTS = {
  INVOICE_CREATED: "billing:invoice-created",
  INVOICE_FINALIZED: "billing:invoice-finalized",
  PAYMENT_POSTED: "billing:payment-posted",
  INVOICE_VOIDED: "billing:invoice-voided",
};

export default billingEvents;
