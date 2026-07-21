/**
 * Radiology Domain Events
 * Event bus and event type definitions for radiology workflows.
 */

const listeners = new Map();

export const radiologyEvents = {
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

export const RADIOLOGY_EVENTS = {
  STUDY_SUBMITTED: "radiology:study:submitted",
  STUDY_APPROVED: "radiology:study:approved",
  STUDY_REJECTED: "radiology:study:rejected",
  IMAGES_ADDED: "radiology:images:added",
  REPORT_SUBMITTED: "radiology:report:submitted",
  STUDY_COMPLETED: "radiology:study:completed",
};

export default radiologyEvents;
