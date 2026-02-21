import Encounter from "../models/Encounter.js";
import { transitionEncounter } from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";

export const startConsultation = async (req, res) => {
  const encounter = await Encounter.create({
    patient: req.body.patient,
    doctor: req.user.id,
    hospital: req.user.hospital,
    appointment: req.body.appointment,
  });

  res.status(201).json(encounter);
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
