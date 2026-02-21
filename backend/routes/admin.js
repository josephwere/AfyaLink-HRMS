import { exportExpiringUsersCSV } from "../controllers/adminVerificationController.js";
import express from "express";
import { createAdmin } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * SUPER_ADMIN → Create Admin
 */
router.post(
  "/create",
  protect,
  requireRole("SUPER_ADMIN"),
  createAdmin
);

router.get(
  "/export/unverified-users",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  exportExpiringUsersCSV
);

export default router;
