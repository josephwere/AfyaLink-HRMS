import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  createPrinterProfile,
  getPrintingConnectors,
  listPrinterProfiles,
  listPrintJobs,
  queuePrintJob,
  updatePrinterProfile,
  updatePrintJobStatus,
} from "../controllers/printingController.js";

const router = express.Router();

router.use(protect);

router.get(
  "/connectors",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"),
  getPrintingConnectors
);

router.get(
  "/profiles",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN"),
  listPrinterProfiles
);
router.post(
  "/profiles",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"),
  createPrinterProfile
);
router.patch(
  "/profiles/:id",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"),
  updatePrinterProfile
);

router.get(
  "/jobs",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST"),
  listPrintJobs
);
router.post(
  "/jobs",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST"),
  queuePrintJob
);
router.patch(
  "/jobs/:id/status",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"),
  updatePrintJobStatus
);

export default router;

