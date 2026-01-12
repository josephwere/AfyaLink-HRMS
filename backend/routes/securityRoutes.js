import express from "express";
import {
  getLiveOccupancy,
  getAlerts,
  getOverstays,
  getAreaHeatmap,
  getSecurityLogs,
} from "../controllers/securityDashboardController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

router.use(protect);
router.use(authorize("SECURITY_OFFICER", "SECURITY_ADMIN", "SUPER_ADMIN"));

router.get("/live", getLiveOccupancy);
router.get("/alerts", getAlerts);
router.get("/overstays", getOverstays);
router.get("/areas", getAreaHeatmap);
router.get("/logs", getSecurityLogs);

export default router;
