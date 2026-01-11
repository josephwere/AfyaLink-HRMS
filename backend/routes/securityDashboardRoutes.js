import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

import {
  liveOccupancy,
  overstays,
  securityAlerts,
  areaOccupancy,
  accessLogs,
} from "../controllers/securityDashboardController.js";

const router = express.Router();

/* ================= SECURITY DASHBOARD ================= */
router.get(
  "/live",
  auth,
  authorize("security", "view"),
  liveOccupancy
);

router.get(
  "/overstays",
  auth,
  authorize("security", "view"),
  overstays
);

router.get(
  "/alerts",
  auth,
  authorize("security", "view"),
  securityAlerts
);

router.get(
  "/areas",
  auth,
  authorize("security", "view"),
  areaOccupancy
);

router.get(
  "/logs",
  auth,
  authorize("security", "view"),
  accessLogs
);

export default router;
