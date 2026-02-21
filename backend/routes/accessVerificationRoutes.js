import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { emergencyGuard } from "../middleware/emergencyGuard.js";
import { authorize } from "../middleware/authorize.js";
import { requireRole } from "../middleware/roleMiddleware.js";

import {
  verifyAccessCode,
  verifyQRToken,
  checkIn,
  checkOut,
} from "../controllers/accessVerificationController.js";

const router = express.Router();

/* ==========================
   🔍 SECURITY VERIFICATION
========================== */

// Manual / Desk verification
router.post(
  "/verify",
  protect,
  emergencyGuard, // 🚨 always before authorize
  authorize("ACCESS_ENTRY", "VERIFY"),
  verifyAccessCode
);

// ONLINE / QR verification
router.post(
  "/verify-qr",
  protect,
  emergencyGuard, // 🚨 critical
  requireRole("SECURITY_OFFICER", "SECURITY_ADMIN", "SUPER_ADMIN"),
  verifyQRToken
);

/* ==========================
   🚪 MOVEMENT
========================== */

router.post(
  "/check-in",
  protect,
  emergencyGuard,
  authorize("ACCESS_ENTRY", "CHECK_IN"),
  checkIn
);

router.post(
  "/check-out",
  protect,
  emergencyGuard,
  authorize("ACCESS_ENTRY", "CHECK_OUT"),
  checkOut
);

export default router;
