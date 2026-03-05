import express from "express";
import multer from "multer";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createStaffTransferRequest,
  listStaffTransferRequests,
  uploadTransferLetter,
  approveSourceTransfer,
  approveTargetTransfer,
  rejectTransfer,
  cancelTransfer,
} from "../controllers/staffTransferController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(protect);

router.get(
  "/",
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "HR_MANAGER",
    "DOCTOR",
    "SURGEON",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "RADIOLOGIST",
    "THERAPIST",
    "RECEPTIONIST",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
    "PAYROLL_OFFICER",
    "COMMUNITY_HEALTH_WORKER"
  ),
  listStaffTransferRequests
);

router.post(
  "/upload-letter",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  upload.single("letter"),
  uploadTransferLetter
);

router.post(
  "/",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  createStaffTransferRequest
);

router.patch(
  "/:id/source-approve",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  approveSourceTransfer
);

router.patch(
  "/:id/target-approve",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  approveTargetTransfer
);

router.patch(
  "/:id/reject",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  rejectTransfer
);

router.patch(
  "/:id/cancel",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "HR_MANAGER"),
  cancelTransfer
);

export default router;
