import { WORKFLOW_EVENTS } from '../../events/index.js';

const workflowBlueprint = {
  [WORKFLOW_EVENTS.APPOINTMENT_CONFIRMED]: [
    { name: 'send-reminder', action: 'notify' },
    { name: 'prepare-queue', action: 'queue' },
  ],
  [WORKFLOW_EVENTS.ARRIVAL_REGISTERED]: [
    { name: 'check-in-notification', action: 'notify' },
  ],
  [WORKFLOW_EVENTS.ENCOUNTER_OPENED]: [
    { name: 'open-timeline', action: 'timeline' },
  ],
};

function normalizeWorkflowSteps(eventType) {
  const steps = workflowBlueprint[eventType] || [];
  return steps.map((step) => ({ ...step, source: eventType }));
}

export function createWorkflowRuntime() {
  return {
    async dispatch(event) {
      const steps = normalizeWorkflowSteps(event?.type);
      return steps.map((step) => ({ ...step, payload: event?.payload || {} }));
    },
  };
}

export const workflowRuntime = createWorkflowRuntime();
