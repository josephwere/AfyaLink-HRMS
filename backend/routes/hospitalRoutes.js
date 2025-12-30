import express from "express";
import {
  createHospital,
  listHospitals,
  getHospitalFeatures,
  updateHospitalFeatures,
} from "../controllers/hospitalController.js";
import auth from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * =========================
 * CREATE HOSPITAL
 * SUPER ADMIN ONLY
 * =========================
 */
router.post(
  "/",
  auth,
  allowRoles("SuperAdmin"),
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
  auth,
  allowRoles("SuperAdmin", "HospitalAdmin"),
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
  auth,
  allowRoles("SuperAdmin"),
  getHospitalFeatures
);

/**
 * Update hospital features
 */
router.put(
  "/:id/features",
  auth,
  allowRoles("SuperAdmin"),
  updateHospitalFeatures
);

export default router;
