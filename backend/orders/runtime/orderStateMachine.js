export const ORDER_STATES = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TRANSITIONS = {
  [ORDER_STATES.PENDING]: [ORDER_STATES.COMPLETED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.COMPLETED]: [],
  [ORDER_STATES.CANCELLED]: [],
};

export function canTransitionOrder(currentState, nextState) {
  return TRANSITIONS[currentState]?.includes(nextState);
}
