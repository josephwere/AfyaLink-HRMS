import express from "express";
import { getActiveEmergencies } from "../controllers/emergencyAdminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { permit } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * SUPER ADMIN EMERGENCY DASHBOARD
 */
router.get(
  "/emergencies/active",
  protect,
  permit("SUPER_ADMIN"),
  getActiveEmergencies
);

export default router;
