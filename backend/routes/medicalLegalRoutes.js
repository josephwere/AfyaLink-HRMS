import express from "express";
import { exportMedicalLegal } from "../controllers/medicalLegalController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { encounterReadGuard } from "../middleware/encounterReadGuard.js";

const router = express.Router();

router.get(
  "/:encounterId/export",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DOCTOR"),
  encounterReadGuard,
  exportMedicalLegal
);

export default router;
