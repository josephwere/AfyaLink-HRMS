import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getDeveloperOverview,
  getDecisionCockpit,
  getTrustStatus,
  getBackgroundJobs,
  retryBackgroundJob,
  runWorkflowSlaScan,
} from "../controllers/developerController.js";

const router = express.Router();

router.get(
  "/overview",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getDeveloperOverview
);

router.get(
  "/trust-status",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getTrustStatus
);

router.get(
  "/decision-cockpit",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getDecisionCockpit
);

router.get(
  "/background-jobs",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getBackgroundJobs
);

router.post(
  "/background-jobs/:id/retry",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  retryBackgroundJob
);

router.post(
  "/workflow-sla/run",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  runWorkflowSlaScan
);

export default router;
