import express from "express";
import {
  shaPreauthorize,
  adminApproveInsurance,
  adminRejectInsurance,
} from "../controllers/insuranceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";


const router = express.Router();

/**
 * INSURANCE ROUTES — SHA
 * 🔒 Workflow authoritative
 * 🔒 Auth required
 */

/* ===============================
   SHA STANDARD PRE-AUTH
=============================== */
router.post(
  "/sha/preauth",
  protect,
  shaPreauthorize
);

/* ===============================
   ADMIN OVERRIDES (JUSTIFIED)
=============================== */

/**
 * POST /api/insurance/admin/approve
 * Body: { encounterId, justification }
 */
router.post(
  "/admin/approve",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  adminApproveInsurance
);

/**
 * POST /api/insurance/admin/reject
 * Body: { encounterId, justification }
 */
router.post(
  "/admin/reject",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  adminRejectInsurance
);

export default router;
