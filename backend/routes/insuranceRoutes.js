import express from "express";
import {
  shaPreauthorize,
  adminApproveInsurance,
  adminRejectInsurance,
} from "../controllers/insuranceController.js";
import { requireAuth } from "../middleware/authMiddleware.js";


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
  requireAuth,
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
  requireAuth,
  adminApproveInsurance
);

/**
 * POST /api/insurance/admin/reject
 * Body: { encounterId, justification }
 */
router.post(
  "/admin/reject",
  requireAuth,
  adminRejectInsurance
);

export default router;
