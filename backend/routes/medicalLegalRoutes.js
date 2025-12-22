import express from "express";
import { exportMedicalLegal } from "../controllers/medicalLegalController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/:encounterId/export",
  requireAuth,
  requireRole("admin", "doctor"),
  exportMedicalLegal
);

export default router;
