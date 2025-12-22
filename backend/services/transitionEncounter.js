import { workflowService } from "./workflowService.js";

/**
 * @deprecated
 * DO NOT mutate Encounter directly.
 * This is a thin wrapper over workflowService.
 */
export async function transitionEncounter(encounterId, nextState, payload, actor) {
  return workflowService.transition({
    workflowType: "CONSULTATION",
    entityId: encounterId,
    to: nextState,
    ctx: payload,
    actor,
  });
}
