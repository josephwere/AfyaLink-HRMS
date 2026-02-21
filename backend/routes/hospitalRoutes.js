import express from "express";
import {
  createHospital,
  listHospitals,
  getHospitalFeatures,
  updateHospitalFeatures,
} from "../controllers/hospitalController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * =========================
 * CREATE HOSPITAL
 * SUPER ADMIN ONLY
 * =========================
 */
router.post(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  createHospital
);

/**
 * =========================
 * LIST HOSPITALS
 * SUPER ADMIN + HOSPITAL ADMIN
 * =========================
 */
router.get(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  listHospitals
);

/**
 * =========================
 * FEATURE TOGGLES (UI SUPPORT)
 * SUPER ADMIN ONLY
 * =========================
 */

/**
 * Get hospital features
 */
router.get(
  "/:id/features",
  protect,
  requireRole("SUPER_ADMIN"),
  getHospitalFeatures
);

/**
 * Update hospital features
 */
router.put(
  "/:id/features",
  protect,
  requireRole("SUPER_ADMIN"),
  updateHospitalFeatures
);

export default router;
