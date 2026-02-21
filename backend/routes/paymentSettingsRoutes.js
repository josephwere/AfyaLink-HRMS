import express from "express";
import {
  saveSettings,
  getSettings,
  requestReveal2FA,
  verifyReveal2FA,
  rotateAdminPassword
} from "../controllers/paymentSettingsController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireRecentStepUp } from "../middleware/riskAdaptiveAuth.js";

const router = express.Router();

router.use(protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"));

// Save encrypted settings
router.post("/save", requireRecentStepUp(20), saveSettings);

// Metadata only (no secrets)
router.get("/get", getSettings);

// Step 1: Request OTP
router.post("/reveal/request", requestReveal2FA);

// Step 2: Verify OTP and reveal secrets
router.post("/reveal/verify", requireRecentStepUp(20), verifyReveal2FA);

// Rotate admin password
router.post("/rotate-password", requireRecentStepUp(20), rotateAdminPassword);

export default router;
