import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  listTrainingTrackers,
  setTrainingDay,
  upsertTrainingTracker,
} from "../controllers/trainingTrackerController.js";

const router = express.Router();

router.get(
  "/tracker",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  listTrainingTrackers
);

router.post(
  "/tracker",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  upsertTrainingTracker
);

router.patch(
  "/tracker/:id/day/:day",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  setTrainingDay
);

export default router;
