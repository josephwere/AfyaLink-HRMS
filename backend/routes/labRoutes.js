import express from "express";
import {
  completeLab,
  createLab,
  deleteLab,
  listLabs,
  uploadLabResult,
} from "../controllers/labController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  listLabs
);

router.post(
  "/",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  createLab
);

router.post(
  "/:id/result",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  uploadLabResult
);

router.delete(
  "/:id",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  deleteLab
);

/**
 * LAB WORKFLOW ROUTE
 * LAB_ORDERED → LAB_COMPLETED
 */
router.post(
  "/complete",
  protect,
  requireRole("LAB_TECH", "DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN"),
  completeLab
);

export default router;
