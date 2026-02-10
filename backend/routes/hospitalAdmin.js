import express from "express";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { registerStaff, getHospitalStaff } from "../controllers/hospitalAdmin.js";

const router = express.Router();

router.use(protect, requireRole("HOSPITAL_ADMIN", "SUPER_ADMIN"));

router.post("/register-staff", registerStaff);
router.get("/staff", getHospitalStaff);

export default router;
