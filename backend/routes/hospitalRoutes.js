import express from "express";
import multer from "multer";
import {
  createHospital,
  listHospitals,
  listMarketplaceHospitals,
  searchGovernmentHospitals,
  getHospitalFeatures,
  updateHospitalFeatures,
  updateHospital,
} from "../controllers/hospitalController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
});

router.get(
  "/registry/search",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  searchGovernmentHospitals
);

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
  upload.fields([
    { name: "registrationCertificate", maxCount: 1 },
    { name: "taxRegistration", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
    { name: "representativeId", maxCount: 1 },
  ]),
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
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"),
  listHospitals
);

router.get(
  "/marketplace",
  protect,
  requireRole("PATIENT", "GUEST", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  listMarketplaceHospitals
);

router.put(
  "/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  updateHospital
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
