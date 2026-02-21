import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  doctorDashboard,
  nurseDashboard,
  hrDashboard,
  payrollDashboard,
  staffDashboard,
  labTechDashboard,
  securityAdminDashboard,
  securityOfficerDashboard,
  hospitalAdminDashboard,
  patientDashboard,
  superAdminDashboard,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/doctor", protect, requireRole("DOCTOR"), doctorDashboard);
router.get("/nurse", protect, requireRole("NURSE"), nurseDashboard);
router.get("/hr", protect, requireRole("HR_MANAGER"), hrDashboard);
router.get("/payroll", protect, requireRole("PAYROLL_OFFICER"), payrollDashboard);
router.get("/staff", protect, requireRole("RECEPTIONIST", "THERAPIST", "RADIOLOGIST"), staffDashboard);
router.get("/lab-tech", protect, requireRole("LAB_TECH"), labTechDashboard);
router.get("/security-admin", protect, requireRole("SECURITY_ADMIN"), securityAdminDashboard);
router.get("/security-officer", protect, requireRole("SECURITY_OFFICER"), securityOfficerDashboard);
router.get("/hospital-admin", protect, requireRole("HOSPITAL_ADMIN"), hospitalAdminDashboard);
router.get("/patient", protect, requireRole("PATIENT"), patientDashboard);
router.get("/super-admin", protect, requireRole("SUPER_ADMIN"), superAdminDashboard);

export default router;
