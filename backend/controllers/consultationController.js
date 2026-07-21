import Encounter from "../models/Encounter.js";
import { transitionEncounter } from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import { createEncounterRuntime } from "../encounter/runtime/encounterRuntime.js";
import { ENCOUNTER_STATES } from "../encounter/runtime/encounterStateMachine.js";
import { createTelemedicineAdapter } from "../encounter/adapters/telemedicineAdapter.js";

function mapRuntimeStateToWorkflowState(state) {
  switch (state) {
    case ENCOUNTER_STATES.CREATED:
      return WORKFLOW.CREATED;
    case ENCOUNTER_STATES.CONSULTING:
      return WORKFLOW.CONSULTING;
    case ENCOUNTER_STATES.CLOSED:
      return WORKFLOW.CLOSED;
    default:
      return state;
  }
}

export const startConsultation = async (req, res) => {
  const runtime = createEncounterRuntime({ publisher: { publish() {} } });
  const mode = String(req.body?.mode || "in-person").toLowerCase();
  const runtimeEncounter = runtime.createEncounter({
    patientId: req.body.patient,
    doctorId: req.user.id,
    mode,
  });

  const encounterDoc = new Encounter({
    patient: req.body.patient,
    doctor: req.user.id,
    hospital: req.user.hospital,
    appointment: req.body.appointment,
    state: mapRuntimeStateToWorkflowState(runtimeEncounter.state),
  });
  encounterDoc.$locals = { ...(encounterDoc.$locals || {}), viaWorkflow: true };
  await encounterDoc.save();

  res.status(201).json({
    encounter: encounterDoc.toObject(),
    runtime: {
      ...runtimeEncounter,
      adapter: mode === "telemedicine" ? createTelemedicineAdapter().connect() : null,
    },
  });
};

export const orderLab = async (req, res) => {
  const { encounterId, labOrderId } = req.body;

  const encounter = await transitionEncounter(
    encounterId,
    WORKFLOW.LAB_ORDERED,
    { labOrderId }
  );

  res.json(encounter);
};
