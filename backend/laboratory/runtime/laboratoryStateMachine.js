export const LABORATORY_STATES = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TRANSITIONS = {
  [LABORATORY_STATES.PENDING]: [LABORATORY_STATES.COMPLETED, LABORATORY_STATES.CANCELLED],
  [LABORATORY_STATES.COMPLETED]: [],
  [LABORATORY_STATES.CANCELLED]: [],
};

export function canTransitionLaboratory(currentState, nextState) {
  return TRANSITIONS[currentState]?.includes(nextState);
}
