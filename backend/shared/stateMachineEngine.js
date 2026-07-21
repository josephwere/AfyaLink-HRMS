export function createStateMachineEngine({ initialState, states }) {
  return {
    initialState,
    canTransition(currentState, nextState) {
      return Boolean(states?.[currentState]?.includes(nextState));
    },
  };
}
