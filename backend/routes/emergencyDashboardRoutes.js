import express from "express";
import auth from "../middleware/auth.js";
import { emergencyDashboard } from "../controllers/emergencyDashboardController.js";

const router = express.Router();

/* ======================================================
   🚨 SUPER ADMIN — EMERGENCY DASHBOARD
====================================================== */
router.get("/emergency-dashboard", auth, emergencyDashboard);

export default router;
