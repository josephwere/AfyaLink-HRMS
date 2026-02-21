import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/systemSettingsController.js";

const router = express.Router();

router.get("/", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), getSystemSettings);
router.put("/", protect, requireRole("SUPER_ADMIN", "DEVELOPER"), updateSystemSettings);

export default router;
