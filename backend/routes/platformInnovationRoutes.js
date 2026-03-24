import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getClinicalOrderCopilot,
  getDigitalHospitalTwin,
  getInteropMarketplace,
} from "../controllers/platformInnovationController.js";

const router = express.Router();

router.get(
  "/clinical-order-copilot",
  protect,
  requireRole("DOCTOR", "SURGEON", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getClinicalOrderCopilot
);

router.get(
  "/digital-twin",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getDigitalHospitalTwin
);

router.get(
  "/interop-marketplace",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getInteropMarketplace
);

export default router;
