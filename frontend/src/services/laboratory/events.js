/**
 * Laboratory Domain Events
 * Event bus and event type definitions for laboratory workflows.
 */

const listeners = new Map();

export const laboratoryEvents = {
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

export const LABORATORY_EVENTS = {
  SAMPLE_SUBMITTED: "laboratory:sample:submitted",
  SAMPLE_APPROVED: "laboratory:sample:approved",
  SAMPLE_REJECTED: "laboratory:sample:rejected",
  RESULT_SUBMITTED: "laboratory:result:submitted",
  RESULT_APPROVED: "laboratory:result:approved",
  RESULT_REJECTED: "laboratory:result:rejected",
  TEST_COMPLETED: "laboratory:test:completed",
};

export default laboratoryEvents;
