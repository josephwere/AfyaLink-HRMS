export const ENCOUNTER_EVENT_TYPES = Object.freeze({
  CREATED: "ENCOUNTER_CREATED",
  TRANSITIONED: "ENCOUNTER_TRANSITIONED",
  CLOSED: "ENCOUNTER_CLOSED",
});

export function buildEncounterEvent(type, payload) {
  return {
    type,
    occurredAt: new Date().toISOString(),
    ...payload,
  };
}
