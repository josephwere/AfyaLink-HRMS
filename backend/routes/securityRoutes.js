import express from "express";

/* ================= CONTROLLERS ================= */
import {
  getLiveOccupancy,
  getAlerts,
  getOverstays,
  getAreaHeatmap,
  getSecurityLogs,
} from "../controllers/securityDashboardController.js";

import { syncOfflineData } from "../controllers/securitySyncController.js";

/* ================= MIDDLEWARE ================= */
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

/* ======================================================
   🔐 GLOBAL SECURITY MIDDLEWARE
====================================================== */
router.use(protect);
router.use(
  authorize(
    "SECURITY_OFFICER",
    "SECURITY_ADMIN",
    "SUPER_ADMIN"
  )
);

/* ======================================================
   📊 SECURITY DASHBOARD ROUTES
====================================================== */
router.get("/live", getLiveOccupancy);       // Who is inside now
router.get("/alerts", getAlerts);            // Violations & warnings
router.get("/overstays", getOverstays);      // Time violations
router.get("/areas", getAreaHeatmap);        // Area heatmap
router.get("/logs", getSecurityLogs);        // Full audit trail

/* ======================================================
   📱 OFFLINE TABLET SYNC
====================================================== */
router.get(
  "/sync",
  authorize("SECURITY_OFFICER", "SECURITY_ADMIN"),
  syncOfflineData
);

export default router;
