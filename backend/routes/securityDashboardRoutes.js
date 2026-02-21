import express from "express";
import { protect } from "../middleware/authMiddleware.js";
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
  protect,
  authorize("security", "view"),
  liveOccupancy
);

router.get(
  "/overstays",
  protect,
  authorize("security", "view"),
  overstays
);

router.get(
  "/alerts",
  protect,
  authorize("security", "view"),
  securityAlerts
);

router.get(
  "/areas",
  protect,
  authorize("security", "view"),
  areaOccupancy
);

router.get(
  "/logs",
  protect,
  authorize("security", "view"),
  accessLogs
);

export default router;
