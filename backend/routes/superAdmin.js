import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  registerHospitalAdmin,
  getHospitals,
  registerSystemAdmin,
  registerDeveloper,
} from "../controllers/superAdmin.js";

const router = express.Router();

router.use(protect);

router.post(
  "/register-hospital-admin",
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  registerHospitalAdmin
);
router.post(
  "/register-system-admin",
  requireRole("SUPER_ADMIN"),
  registerSystemAdmin
);
router.post(
  "/register-developer",
  requireRole("SUPER_ADMIN"),
  registerDeveloper
);
router.get("/hospitals", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"), getHospitals);

export default router;
