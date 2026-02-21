import express from "express";
import {
  getHospitalConfig,
  updateHospitalFeatures,
  updateHospitalCommerceConfig,
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

export default router;
