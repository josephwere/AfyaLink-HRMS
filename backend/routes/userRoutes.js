import express from "express";
import { getMe, listUsers, updateUser } from "../controllers/userController.js";
import auth from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * Get current user (any authenticated user)
 */
router.get("/me", auth, getMe);

/**
 * List all users (ADMIN ONLY)
 */
router.get(
  "/",
  auth,
  allowRoles("SuperAdmin", "HospitalAdmin"),
  listUsers
);

/**
 * Update user (ADMIN ONLY)
 */
router.patch(
  "/:id",
  auth,
  allowRoles("SuperAdmin", "HospitalAdmin"),
  updateUser
);

export default router;
