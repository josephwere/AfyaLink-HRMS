// backend/routes/aiRoutes.js

import express from "express";
import { suggestSlot, patientRisk } from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";

const router = express.Router();

/**
 * ======================================================
 * 🤖 AI ROUTES (PLAN-GATED)
 * Feature required: ai
 * ======================================================
 */
router.use(
  protect,
  planGuard({ feature: "ai" }) // 🔐 AI FEATURE TOGGLE
);

router.get("/slot", suggestSlot);
router.post("/risk", patientRisk);

export default router;
