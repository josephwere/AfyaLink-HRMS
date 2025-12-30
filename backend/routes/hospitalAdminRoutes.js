import express from "express";
import {
  getHospitalConfig,
  updateHospitalFeatures,
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
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  getHospitalConfig
);

router.put(
  "/features",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  updateHospitalFeatures
);

export default router;
