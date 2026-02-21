import express from "express";
import { adminOverride } from "../controllers/workflowAdminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireRecentStepUp } from "../middleware/riskAdaptiveAuth.js";

const router = express.Router();

router.post(
  "/override",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"),
  requireRecentStepUp(15),
  adminOverride
);

export default router;
