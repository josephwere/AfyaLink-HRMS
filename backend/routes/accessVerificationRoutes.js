import express from "express";
import auth from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

import {
  verifyAccessCode,
  checkInAccess,
  checkOutAccess,
} from "../controllers/accessVerificationController.js";

const router = express.Router();

/* ================= SECURITY VERIFICATION ================= */
router.post(
  "/verify",
  auth,
  authorize("security", "verify"),
  verifyAccessCode
);

router.post(
  "/check-in",
  auth,
  authorize("security", "verify"),
  checkInAccess
);

router.post(
  "/check-out",
  auth,
  authorize("security", "verify"),
  checkOutAccess
);

export default router;
