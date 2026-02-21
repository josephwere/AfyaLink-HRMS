import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireRecentStepUp } from "../middleware/riskAdaptiveAuth.js";
import { adminOverrideWorkflow } from "../controllers/adminWorkflowController.js";

const router = express.Router();

/**
 * ADMIN WORKFLOW OVERRIDES
 */
router.post(
  "/override",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"),
  requireRecentStepUp(15),
  adminOverrideWorkflow
);

export default router;
