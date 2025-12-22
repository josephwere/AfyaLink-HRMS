import { transitionEncounter } from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";

export const markPaid = async (req, res) => {
  const encounter = await transitionEncounter(
    req.body.encounterId,
    WORKFLOW.PAID
  );

  res.json(encounter);
};
