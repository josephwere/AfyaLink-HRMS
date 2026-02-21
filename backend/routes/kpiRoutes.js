import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { hospitalKPIs } from "../controllers/kpiController.js";

const router = express.Router();

/**
 * HOSPITAL KPIs
 * 🔒 Admin only
 */
router.get(
  "/",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"),
  hospitalKPIs
);

export default router;
