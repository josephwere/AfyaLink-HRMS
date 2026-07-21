const listeners = new Map();

export const pharmacyEvents = {
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

export const PHARMACY_EVENTS = {
  ITEM_CREATED: "pharmacy:item-created",
  ITEM_UPDATED: "pharmacy:item-updated",
  ITEM_DELETED: "pharmacy:item-deleted",
  STOCK_ADDED: "pharmacy:stock-added",
  STOCK_DISPENSED: "pharmacy:stock-dispensed",
};

export default pharmacyEvents;
