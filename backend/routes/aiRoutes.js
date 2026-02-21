// backend/routes/aiRoutes.js

import express from "express";
import multer from "multer";
import { suggestSlot, patientRisk, extractDocument } from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

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
router.post("/extract", upload.single("file"), extractDocument);

export default router;
