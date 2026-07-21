import { emitOperationalEvent } from "./operationalEventGateway.js";

const workflowBlueprints = {
  PATIENT_ADMITTED: [
    {
      type: "BED_ASSIGNED",
      workflowStep: "assign-bed",
      notification: {
        title: "Bed assigned",
        body: "A bed has been assigned to the patient.",
        category: "ADMISSIONS",
      },
    },
  ],
};

export async function orchestrateOperationalWorkflow(event) {
  const blueprints = workflowBlueprints[event?.type] || [];

  for (const blueprint of blueprints) {
    await emitOperationalEvent({
      ...event,
      type: blueprint.type,
      payload: {
        ...event.payload,
        workflowStep: blueprint.workflowStep,
        notification: blueprint.notification,
      },
    });
  }

  return blueprints;
}
