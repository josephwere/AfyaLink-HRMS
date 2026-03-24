import express from "express";
import {
  getHospitalConfig,
  getHospitalCustomizationHistory,
  restoreHospitalCustomizationRevision,
  updateHospitalFeatures,
  updateHospitalCommerceConfig,
  updateHospitalCustomization,
} from "../controllers/hospitalAdminController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ======================================================
   HOSPITAL ADMIN CONFIG
====================================================== */
router.get(
  "/config",
  protect,
  getHospitalConfig
);

router.put(
  "/features",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  updateHospitalFeatures
);

router.put(
  "/commerce-config",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  updateHospitalCommerceConfig
);

router.put(
  "/customization",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  updateHospitalCustomization
);

router.get(
  "/customization/history",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  getHospitalCustomizationHistory
);

router.post(
  "/customization/restore/:revisionId",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  restoreHospitalCustomizationRevision
);

export default router;
