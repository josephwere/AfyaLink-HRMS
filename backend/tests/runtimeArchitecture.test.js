import { createStateMachineEngine } from '../shared/stateMachineEngine.js';
import { workflowRuntime } from '../workflow/runtime/workflowRuntime.js';
import { LABORATORY_EVENTS, RADIOLOGY_EVENTS } from '../events/index.js';

describe('runtime architecture foundation', () => {
  it('provides reusable state machine transitions for runtime domains', () => {
    const machine = createStateMachineEngine({
      initialState: 'Pending',
      states: {
        Pending: ['Completed', 'Cancelled'],
        Completed: [],
        Cancelled: [],
      },
    });

    expect(machine.canTransition('Pending', 'Completed')).toBe(true);
    expect(machine.canTransition('Completed', 'Pending')).toBe(false);
  });

  it('routes workflow steps through the shared workflow runtime', async () => {
    const result = await workflowRuntime.dispatch({
      type: 'APPOINTMENT_CONFIRMED',
      payload: { appointmentId: 'apt-1' },
    });

    expect(result).toBeTruthy();
    expect(result.some((step) => step.name === 'send-reminder')).toBe(true);
  });

  it('keeps event names centralized for clinical runtimes', () => {
    expect(LABORATORY_EVENTS.ORDER_CREATED).toBe('LABORATORY_ORDER_CREATED');
    expect(RADIOLOGY_EVENTS.STUDY_CREATED).toBe('RADIOLOGY_STUDY_CREATED');
  });
});
