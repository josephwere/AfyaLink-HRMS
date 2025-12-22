import express from "express";
import {
  saveSettings,
  getSettings,
  requestReveal2FA,
  verifyReveal2FA,
  rotateAdminPassword
} from "../controllers/paymentSettingsController.js";

import auth from "../middleware/auth.js";

const router = express.Router();

// Save encrypted settings
router.post("/save", auth, saveSettings);

// Metadata only (no secrets)
router.get("/get", auth, getSettings);

// Step 1: Request OTP
router.post("/reveal/request", auth, requestReveal2FA);

// Step 2: Verify OTP and reveal secrets
router.post("/reveal/verify", auth, verifyReveal2FA);

// Rotate admin password
router.post("/rotate-password", auth, rotateAdminPassword);

export default router;
