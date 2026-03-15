import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  submitClaim,
  listClaims,
  getClaim,
  listClaimAuditLogs,
  reviewClaim,
  listFraudAlerts,
  getFraudSummary,
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
  "/alerts",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"),
  listFraudAlerts
);

router.get(
  "/:id/audit",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  listClaimAuditLogs
);

router.get(
  "/:id",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  getClaim
);

router.post(
  "/:id/review",
  protect,
  requireRole("SYSTEM_ADMIN", "SUPER_ADMIN"),
  reviewClaim
);

export default router;
