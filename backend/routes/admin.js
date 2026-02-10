import { exportExpiringUsersCSV } from "../controllers/adminVerificationController.js";
import express from "express";
import { createAdmin } from "../controllers/adminController.js";
import auth from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * SUPER_ADMIN → Create Admin
 */
router.post(
  "/create",
  auth,
  allowRoles("SUPER_ADMIN"),
  createAdmin
);

router.get(
  "/export/unverified-users",
  auth,
  allowRoles("SUPER_ADMIN", "HOSPITAL_ADMIN"),
  exportExpiringUsersCSV
);

export default router;
