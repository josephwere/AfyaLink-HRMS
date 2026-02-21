// backend/routes/workflowReplayRoutes.js
import express from "express";
import { replayWorkflow } from "../controllers/workflowReplayController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * Replay a workflow for an encounter (admin/debug)
 */
router.get(
  "/:encounterId/replay",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"),
  replayWorkflow
);

export default router;
