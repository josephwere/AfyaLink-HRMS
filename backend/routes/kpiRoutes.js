import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { hospitalKPIs } from "../controllers/kpiController.js";

const router = express.Router();

/**
 * HOSPITAL KPIs
 * 🔒 Admin only
 */
router.get("/", requireAuth, hospitalKPIs);

export default router;
