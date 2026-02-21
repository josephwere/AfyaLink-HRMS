import express from "express";
import {
  bookVisitorAccess,
  bookStaffOrContractorAccess,
} from "../controllers/accessBookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* Visitor booking (staff assisted or self) */
router.post(
  "/visitor",
  protect,
  requireRole("HOSPITAL_ADMIN", "SECURITY_ADMIN", "SECURITY_OFFICER", "SUPER_ADMIN", "SYSTEM_ADMIN"),
  bookVisitorAccess
);

/* Staff / Contractor booking */
router.post(
  "/internal",
  protect,
  requireRole("HOSPITAL_ADMIN", "SECURITY_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN"),
  bookStaffOrContractorAccess
);

export default router;
