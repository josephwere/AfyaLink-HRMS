import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { emergencyDashboard } from "../controllers/emergencyDashboardController.js";

const router = express.Router();

/* ======================================================
   🚨 SUPER ADMIN — EMERGENCY DASHBOARD
====================================================== */
router.get("/emergency-dashboard", protect, emergencyDashboard);

export default router;
