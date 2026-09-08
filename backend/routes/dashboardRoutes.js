import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { cacheJsonResponse } from "../middleware/responseCache.js";
import {
  doctorDashboard,
  nurseDashboard,
  executiveDashboard,
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
const realtimeDashboardCache = cacheJsonResponse({ ttlSeconds: 10 });
const standardDashboardCache = cacheJsonResponse({ ttlSeconds: 15 });
const summaryDashboardCache = cacheJsonResponse({ ttlSeconds: 20 });
const staticDashboardCache = cacheJsonResponse({ ttlSeconds: 300 });

router.get(
  "/executive",
  protect,
  summaryDashboardCache,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "CFO", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  executiveDashboard
);
router.get("/doctor", protect, standardDashboardCache, requireRole("DOCTOR"), doctorDashboard);
router.get("/nurse", protect, standardDashboardCache, requireRole("NURSE"), nurseDashboard);
router.get("/hr", protect, standardDashboardCache, requireRole("HR_MANAGER"), hrDashboard);
router.get("/payroll", protect, standardDashboardCache, requireRole("PAYROLL_OFFICER"), payrollDashboard);
router.get(
  "/staff",
  protect,
  standardDashboardCache,
  requireRole("RECEPTIONIST", "THERAPIST", "RADIOLOGIST"),
  staffDashboard
);
router.get("/radiologist", protect, standardDashboardCache, requireRole("RADIOLOGIST"), radiologistDashboard);
router.get("/therapist", protect, standardDashboardCache, requireRole("THERAPIST"), therapistDashboard);
router.get("/receptionist", protect, standardDashboardCache, requireRole("RECEPTIONIST"), receptionistDashboard);
router.get("/surgeon", protect, standardDashboardCache, requireRole("SURGEON"), surgeonDashboard);
router.get("/lab-tech", protect, standardDashboardCache, requireRole("LAB_TECH"), labTechDashboard);
router.get("/security-admin", protect, standardDashboardCache, requireRole("SECURITY_ADMIN"), securityAdminDashboard);
router.get("/security-officer", protect, standardDashboardCache, requireRole("SECURITY_OFFICER"), securityOfficerDashboard);
router.get(
  "/hospital-admin",
  protect,
  summaryDashboardCache,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"),
  hospitalAdminDashboard
);
router.get("/patient", protect, standardDashboardCache, requireRole("PATIENT"), patientDashboard);
router.get("/super-admin", protect, summaryDashboardCache, requireRole("SUPER_ADMIN"), superAdminDashboard);
router.get(
  "/community-health-worker",
  protect,
  standardDashboardCache,
  requireRole("COMMUNITY_HEALTH_WORKER"),
  communityHealthWorkerDashboard
);
router.get(
  "/ops/triage",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  triageOpsDashboard
);
router.get(
  "/ops/icu",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  icuOpsDashboard
);
router.get(
  "/ops/theatre",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  theatreOpsDashboard
);
router.get(
  "/ops/imaging",
  protect,
  realtimeDashboardCache,
  requireRole("RADIOLOGIST", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  imagingOpsDashboard
);
router.get(
  "/ops/emergency-command",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "SURGEON", "NURSE", "SECURITY_ADMIN", "SECURITY_OFFICER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  emergencyCommandDashboard
);
router.get(
  "/ops/neonatal-icu",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "SURGEON", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  neonatalIcuDashboard
);
router.get(
  "/ops/dialysis",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  dialysisOpsDashboard
);
router.get(
  "/ops/oncology-daycare",
  protect,
  realtimeDashboardCache,
  requireRole("DOCTOR", "NURSE", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  oncologyDaycareDashboard
);
router.get(
  "/action-matrix",
  protect,
  staticDashboardCache,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  getDashboardActionMatrix
);
router.get(
  "/action-matrix/export.csv",
  protect,
  staticDashboardCache,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  exportDashboardActionMatrixCsv
);

export default router;
