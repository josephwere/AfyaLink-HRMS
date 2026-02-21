// backend/routes/staffRoutes.js

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";

import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deactivateStaff, // 👈 soft delete
} from "../controllers/staffController.js";

const router = express.Router();

/**
 * ======================================================
 * 🔐 AUTH + ROLE GUARD
 * ======================================================
 */
router.use(
  protect,
  requireRole("HOSPITAL_ADMIN", "SUPER_ADMIN")
);

/**
 * ======================================================
 * 👥 LIST STAFF
 * ======================================================
 */
router.get("/", getAllStaff);

/**
 * ======================================================
 * 👤 GET STAFF BY ID
 * ======================================================
 */
router.get("/:id", getStaffById);

/**
 * ======================================================
 * ➕ CREATE STAFF — PLAN LIMITED
 * ======================================================
 */
router.post(
  "/",
  planGuard({ limitKey: "users" }), // 🧍 STAFF LIMIT ENFORCED
  createStaff
);

/**
 * ======================================================
 * ✏️ UPDATE STAFF
 * ======================================================
 */
router.put("/:id", updateStaff);

/**
 * ======================================================
 * 🚫 DEACTIVATE STAFF (SOFT DELETE)
 * ✔ reversible
 * ✔ auditable
 * ✔ compliant
 * ======================================================
 */
router.patch("/:id/deactivate", deactivateStaff);

export default router;
