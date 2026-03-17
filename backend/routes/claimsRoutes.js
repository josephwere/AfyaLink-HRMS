import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  submitClaim,
  listClaims,
  getClaim,
  listClaimAuditLogs,
  reviewClaim,
  requestClaimVerification,
  assignClaimAudit,
  addFraudFeedback,
  listFraudAlerts,
  getFraudSummary,
  getGovernmentDashboard,
  getGovernmentPatientHistory,
} from "../controllers/claimsController.js";

const router = express.Router();

router.post(
  "/",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  submitClaim
);

router.get(
  "/",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  listClaims
);

router.get(
  "/summary",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN"),
  getFraudSummary
);

router.get(
  "/government/overview",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_ANALYST"),
  getGovernmentDashboard
);

router.get(
  "/government/patient-history",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR", "GOVERNMENT_ANALYST"),
  getGovernmentPatientHistory
);

router.get(
  "/alerts",
  protect,
  requireRole(
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_AUDITOR",
    "GOVERNMENT_INSPECTOR",
    "GOVERNMENT_ANALYST"
  ),
  listFraudAlerts
);

router.get(
  "/:id/audit",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_AUDITOR",
    "GOVERNMENT_INSPECTOR",
    "GOVERNMENT_ANALYST"
  ),
  listClaimAuditLogs
);

router.get(
  "/:id",
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_AUDITOR",
    "GOVERNMENT_INSPECTOR",
    "GOVERNMENT_ANALYST"
  ),
  getClaim
);

router.post(
  "/:id/review",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR"),
  reviewClaim
);

router.post(
  "/:id/request-verification",
  protect,
  requireRole(
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DEVELOPER",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_AUDITOR"
  ),
  requestClaimVerification
);

router.post(
  "/:id/assign",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR"),
  assignClaimAudit
);

router.post(
  "/alerts/:id/feedback",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "GOVERNMENT_REGULATOR", "GOVERNMENT_ADMIN", "GOVERNMENT_AUDITOR"),
  addFraudFeedback
);

export default router;
