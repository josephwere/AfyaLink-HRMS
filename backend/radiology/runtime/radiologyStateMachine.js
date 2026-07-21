export const RADIOLOGY_STATES = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const TRANSITIONS = {
  [RADIOLOGY_STATES.PENDING]: [RADIOLOGY_STATES.COMPLETED, RADIOLOGY_STATES.CANCELLED],
  [RADIOLOGY_STATES.COMPLETED]: [],
  [RADIOLOGY_STATES.CANCELLED]: [],
};

export function canTransitionRadiology(currentState, nextState) {
  return TRANSITIONS[currentState]?.includes(nextState);
}
