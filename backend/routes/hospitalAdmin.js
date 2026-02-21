import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { registerStaff, getHospitalStaff } from "../controllers/hospitalAdmin.js";

const router = express.Router();

router.use(protect, requireRole("HOSPITAL_ADMIN"));

router.post("/register-staff", registerStaff);
router.get("/staff", getHospitalStaff);

export default router;
