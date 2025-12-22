// backend/routes/workflowReplayRoutes.js
import express from "express";
import { replayWorkflow } from "../controllers/workflowReplayController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Replay a workflow for an encounter (admin/debug)
 */
router.get(
  "/:encounterId/replay",
  requireAuth,
  replayWorkflow
);

export default router;
