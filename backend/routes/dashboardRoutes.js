import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  doctorDashboard,
  nurseDashboard,
  hrDashboard,
  payrollDashboard,
  staffDashboard,
  radiologistDashboard,
  therapistDashboard,
  receptionistDashboard,
  surgeonDashboard,
  labTechDashboard,
  securityAdminDashboard,
  securityOfficerDashboard,
  hospitalAdminDashboard,
  patientDashboard,
  superAdminDashboard,
  communityHealthWorkerDashboard,
  triageOpsDashboard,
  icuOpsDashboard,
  theatreOpsDashboard,
  imagingOpsDashboard,
  emergencyCommandDashboard,
  neonatalIcuDashboard,
  dialysisOpsDashboard,
  oncologyDaycareDashboard,
  getDashboardActionMatrix,
  exportDashboardActionMatrixCsv,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/doctor", protect, requireRole("DOCTOR"), doctorDashboard);
router.get("/nurse", protect, requireRole("NURSE"), nurseDashboard);
router.get("/hr", protect, requireRole("HR_MANAGER"), hrDashboard);
router.get("/payroll", protect, requireRole("PAYROLL_OFFICER"), payrollDashboard);
router.get("/staff", protect, requireRole("RECEPTIONIST", "THERAPIST", "RADIOLOGIST"), staffDashboard);
router.get("/radiologist", protect, requireRole("RADIOLOGIST"), radiologistDashboard);
router.get("/therapist", protect, requireRole("THERAPIST"), therapistDashboard);
router.get("/receptionist", protect, requireRole("RECEPTIONIST"), receptionistDashboard);
router.get("/surgeon", protect, requireRole("SURGEON"), surgeonDashboard);
router.get("/lab-tech", protect, requireRole("LAB_TECH"), labTechDashboard);
router.get("/security-admin", protect, requireRole("SECURITY_ADMIN"), securityAdminDashboard);
router.get("/security-officer", protect, requireRole("SECURITY_OFFICER"), securityOfficerDashboard);
router.get("/hospital-admin", protect, requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"), hospitalAdminDashboard);
router.get("/patient", protect, requireRole("PATIENT"), patientDashboard);
router.get("/super-admin", protect, requireRole("SUPER_ADMIN"), superAdminDashboard);
router.get("/community-health-worker", protect, requireRole("COMMUNITY_HEALTH_WORKER"), communityHealthWorkerDashboard);
router.get(
  "/ops/triage",
  protect,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  triageOpsDashboard
);
router.get(
  "/ops/icu",
  protect,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  icuOpsDashboard
);
router.get(
  "/ops/theatre",
  protect,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  theatreOpsDashboard
);
router.get(
  "/ops/imaging",
  protect,
  requireRole("RADIOLOGIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  imagingOpsDashboard
);
router.get(
  "/ops/emergency-command",
  protect,
  requireRole("DOCTOR", "SURGEON", "NURSE", "SECURITY_ADMIN", "SECURITY_OFFICER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  emergencyCommandDashboard
);
router.get(
  "/ops/neonatal-icu",
  protect,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  neonatalIcuDashboard
);
router.get(
  "/ops/dialysis",
  protect,
  requireRole("DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  dialysisOpsDashboard
);
router.get(
  "/ops/oncology-daycare",
  protect,
  requireRole("DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  oncologyDaycareDashboard
);
router.get(
  "/action-matrix",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  getDashboardActionMatrix
);
router.get(
  "/action-matrix/export.csv",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  exportDashboardActionMatrixCsv
);

export default router;
