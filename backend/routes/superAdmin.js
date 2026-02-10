import express from "express";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { registerHospitalAdmin, getHospitals } from "../controllers/superAdmin.js";

const router = express.Router();

router.use(protect, requireRole("SUPER_ADMIN"));

router.post("/register-hospital-admin", registerHospitalAdmin);
router.get("/hospitals", getHospitals);

export default router;
