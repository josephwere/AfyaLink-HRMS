import express from "express";
import { getActiveEmergencies } from "../controllers/emergencyAdminController.js";
import auth from "../middleware/auth.js";
import { permit } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * SUPER ADMIN EMERGENCY DASHBOARD
 */
router.get(
  "/emergencies/active",
  auth,
  permit("super_admin"),
  getActiveEmergencies
);

export default router;
