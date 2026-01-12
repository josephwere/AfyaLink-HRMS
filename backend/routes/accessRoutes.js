import express from "express";
import {
  bookVisitorAccess,
  bookStaffOrContractorAccess,
} from "../controllers/accessBookingController.js";
import { verifyAccessCode } from "../controllers/accessVerificationController.js";
import { checkIn, checkOut } from "../controllers/accessMovementController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();

/* ==========================
   BOOKINGS
========================== */

router.post(
  "/book/visitor",
  protect,
  authorize("ACCESS_ENTRY", "CREATE_VISITOR"),
  bookVisitorAccess
);

router.post(
  "/book/staff",
  protect,
  authorize("ACCESS_ENTRY", "CREATE_STAFF"),
  bookStaffOrContractorAccess
);

/* ==========================
   SECURITY VERIFICATION
========================== */

router.post(
  "/verify",
  protect,
  authorize("ACCESS_ENTRY", "VERIFY"),
  verifyAccessCode
);

/* ==========================
   MOVEMENT
========================== */

router.post(
  "/check-in",
  protect,
  authorize("ACCESS_ENTRY", "CHECK_IN"),
  checkIn
);

router.post(
  "/check-out",
  protect,
  authorize("ACCESS_ENTRY", "CHECK_OUT"),
  checkOut
);

export default router;
