import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getPublicBranding,
  getAssetDeliveryHealth,
  getEmailDeliveryHealth,
  getSystemSettings,
  getSystemSettingsHistory,
  restoreSystemSettingsRevision,
  updateSystemSettings,
} from "../controllers/systemSettingsController.js";

const router = express.Router();

router.get("/public", getPublicBranding);
router.get("/asset-health", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getAssetDeliveryHealth);
router.get("/email-health", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getEmailDeliveryHealth);
router.get("/history", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getSystemSettingsHistory);
router.post("/restore/:revisionId", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), restoreSystemSettingsRevision);
router.get("/", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getSystemSettings);
router.put("/", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), updateSystemSettings);

export default router;
