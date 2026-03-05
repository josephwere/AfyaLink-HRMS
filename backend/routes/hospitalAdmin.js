import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { registerStaff, getHospitalStaff } from "../controllers/hospitalAdmin.js";

const router = express.Router();

router.use(
  protect,
  requireRole(
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "HR_MANAGER",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DEVELOPER"
  )
);

router.post("/register-staff", registerStaff);
router.get("/staff", getHospitalStaff);

export default router;
