const listeners = new Map();

export const encounterEvents = {
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

export const ENCOUNTER_EVENTS = {
  CREATED: "encounter:created",
  UPDATED: "encounter:updated",
  CLOSED: "encounter:closed",
  ESCALATED: "encounter:escalated",
  CLOSEOUT_APPLIED: "encounter:closeout-applied",
  BILLING_HANDOFF: "encounter:billing-handoff",
};

export default encounterEvents;
