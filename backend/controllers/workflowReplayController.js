// backend/controllers/workflowReplayController.js

import Workflow from "../models/Workflow.js";

/**
 * Replay workflow timeline for audit / debugging
 * Admin-only endpoint
 */
export async function replayWorkflow(req, res) {
  try {
    const { encounterId } = req.params;

    if (!encounterId) {
      return res.status(400).json({ error: "Encounter ID is required" });
    }

    const workflow = await Workflow.findOne({
      encounter: encounterId,
    }).lean();

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const history = Array.isArray(workflow.history)
      ? workflow.history
      : [];

    return res.json({
      encounterId,
      initialState: history[0] || null,
      timeline: history,
      finalState: workflow.state || null,
    });
  } catch (error) {
    console.error("Workflow replay error:", error);
    return res.status(500).json({
      error: "Failed to replay workflow",
    });
  }
}
