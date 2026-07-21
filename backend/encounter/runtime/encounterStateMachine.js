export const ENCOUNTER_STATES = Object.freeze({
  CREATED: "CREATED",
  CONSULTING: "CONSULTING",
  CLOSED: "CLOSED",
});

export function canTransition(state, nextState) {
  const valid = {
    [ENCOUNTER_STATES.CREATED]: [ENCOUNTER_STATES.CONSULTING, ENCOUNTER_STATES.CLOSED],
    [ENCOUNTER_STATES.CONSULTING]: [ENCOUNTER_STATES.CLOSED],
    [ENCOUNTER_STATES.CLOSED]: [],
  };

  return valid[state]?.includes(nextState) ?? false;
}
