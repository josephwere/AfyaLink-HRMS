const EVENT_TARGET = typeof window !== "undefined" ? window : globalThis;
const bus = new EventTarget();

export const NEUROEDGE_EVENT_TYPES = {
  USER_SIGNED_IN: "USER_SIGNED_IN",
  USER_SIGNED_OUT: "USER_SIGNED_OUT",
  ROLE_CHANGED: "ROLE_CHANGED",
  PAGE_OPENED: "PAGE_OPENED",
  PATIENT_SELECTED: "PATIENT_SELECTED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  APPOINTMENT_OPENED: "APPOINTMENT_OPENED",
  APPOINTMENT_COMPLETED: "APPOINTMENT_COMPLETED",
  PRESCRIPTION_OPENED: "PRESCRIPTION_OPENED",
  LAB_RESULT_SELECTED: "LAB_RESULT_SELECTED",
  NOTE_EDITING_STARTED: "NOTE_EDITING_STARTED",
  FORM_OPENED: "FORM_OPENED",
  FIELD_FOCUSED: "FIELD_FOCUSED",
  FIELD_CHANGED: "FIELD_CHANGED",
  FORM_SUBMITTED: "FORM_SUBMITTED",
  HOSPITAL_CHANGED: "HOSPITAL_CHANGED",
  DEPARTMENT_CHANGED: "DEPARTMENT_CHANGED",
};

function createEventPayload(type, detail = {}) {
  return {
    type,
    timestamp: Date.now(),
    detail: { ...detail },
  };
}

export function publishNeuroEdgeEvent(type, detail = {}) {
  const payload = createEventPayload(type, detail);
  const event = new CustomEvent("neuroedge:event", { detail: payload });
  if (EVENT_TARGET.dispatchEvent) {
    EVENT_TARGET.dispatchEvent(event);
  }
  bus.dispatchEvent(new CustomEvent(type, { detail: payload }));
  return payload;
}

export function subscribeToNeuroEdgeEvent(type, listener) {
  if (!listener) return () => {};
  const eventName = type || "neuroedge:event";
  const handler = (event) => listener(event.detail);
  bus.addEventListener(eventName, handler);
  return () => bus.removeEventListener(eventName, handler);
}

export function subscribeToNeuroEdgeEvents(listener) {
  if (!listener) return () => {};
  const handler = (event) => listener(event.detail);
  bus.addEventListener("neuroedge:event", handler);
  return () => bus.removeEventListener("neuroedge:event", handler);
}
