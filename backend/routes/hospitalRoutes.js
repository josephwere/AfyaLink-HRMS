import express from "express";
import {
  createHospital,
  listHospitals,
} from "../controllers/hospitalController.js";
import auth from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * Create hospital (SUPER ADMIN ONLY)
 */
router.post(
  "/",
  auth,
  allowRoles("SuperAdmin"),
  createHospital
);

/**
 * List hospitals (SUPER ADMIN + HOSPITAL ADMIN)
 */
router.get(
  "/",
  auth,
  allowRoles("SuperAdmin", "HospitalAdmin"),
  listHospitals
);

export default router;
