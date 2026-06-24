import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getGovernmentOverview,
  listGovernmentClaims,
  listGovernmentHospitals,
  listInspections,
  createInspection,
  updateInspection,
  listEnforcementActions,
  createEnforcementAction,
  updateEnforcementAction,
  listHealthFunds,
  createHealthFund,
  updateHealthFund,
  listGovernmentNotifications,
  listAuditLogs,
} from "../controllers/governmentDashboardController.js";
import {
  listGovernmentStaff,
  registerGovernmentStaff,
} from "../controllers/governmentStaffController.js";

const router = express.Router();

const GOVERNMENT_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
];

router.use(protect, requireRole(...GOVERNMENT_ROLES));

router.get("/overview", getGovernmentOverview);
router.get("/staff", listGovernmentStaff);
router.post("/staff", registerGovernmentStaff);
router.get("/claims", listGovernmentClaims);
router.get("/hospitals", listGovernmentHospitals);
router.get("/inspections", listInspections);
router.post("/inspections", createInspection);
router.patch("/inspections/:id", updateInspection);
router.get("/enforcement", listEnforcementActions);
router.post("/enforcement", createEnforcementAction);
router.patch("/enforcement/:id", updateEnforcementAction);
router.get("/health-funds", listHealthFunds);
router.post("/health-funds", createHealthFund);
router.patch("/health-funds/:id", updateHealthFund);
router.get("/notifications", listGovernmentNotifications);
router.get("/audit-logs", listAuditLogs);

export default router;
