/**
 * Workflow Domain Events
 * Event bus and event type definitions for workflow orchestration.
 */

const listeners = new Map();

export const workflowEvents = {
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

export const WORKFLOW_EVENTS = {
  WORKFLOW_CREATED: "workflow:workflow:created",
  WORKFLOW_STARTED: "workflow:workflow:started",
  STEP_STARTED: "workflow:step:started",
  STEP_COMPLETED: "workflow:step:completed",
  STEP_FAILED: "workflow:step:failed",
  WORKFLOW_COMPLETED: "workflow:workflow:completed",
  WORKFLOW_FAILED: "workflow:workflow:failed",
  WORKFLOW_PAUSED: "workflow:workflow:paused",
};

export default workflowEvents;
