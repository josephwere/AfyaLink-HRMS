import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createComplianceLegalHold,
  getComplianceCenter,
  releaseComplianceLegalHold,
} from "../controllers/complianceController.js";

const router = express.Router();

router.get(
  "/center",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getComplianceCenter
);

router.post(
  "/legal-holds",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  createComplianceLegalHold
);

router.post(
  "/legal-holds/:id/release",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  releaseComplianceLegalHold
);

export default router;
