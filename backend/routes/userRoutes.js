// backend/routes/userRoutes.js

import express from "express";
import {
  getMe,
  listUsers,
  updateUser,
  createUser,
} from "../controllers/userController.js";

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";

const router = express.Router();

/**
 * ======================================================
 * 👤 CURRENT USER
 * ======================================================
 */
router.get("/me", protect, getMe);

/**
 * ======================================================
 * 👥 CREATE USER (STAFF) — PLAN LIMITED
 * SUPER_ADMIN / HOSPITAL_ADMIN
 * ======================================================
 */
router.post(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  planGuard({ limitKey: "users" }), // 🧍 STAFF LIMIT ENFORCED HERE
  createUser
);

/**
 * ======================================================
 * 📋 LIST USERS (ACTIVE ONLY)
 * SUPER_ADMIN / HOSPITAL_ADMIN
 * ======================================================
 */
router.get(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  listUsers
);

/**
 * ======================================================
 * ✏️ UPDATE USER
 * SUPER_ADMIN / HOSPITAL_ADMIN
 * ======================================================
 */
router.patch(
  "/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  updateUser
);

export default router;
