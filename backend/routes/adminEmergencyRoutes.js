import express from "express";
import { getActiveEmergencies } from "../controllers/emergencyAdminController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * SUPER ADMIN EMERGENCY DASHBOARD
 */
router.get(
  "/emergencies/active",
  requireAuth,
  getActiveEmergencies
);

export default router;
