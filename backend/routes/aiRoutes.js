// backend/routes/aiRoutes.js

import express from "express";
import multer from "multer";
import {
  suggestSlot,
  patientRisk,
  extractDocument,
  getAssistantContext,
  updateAssistantProfile,
  getAssistantAdvice,
  getAssistantChat,
  summarizeAssistantPage,
  clearAssistantMemory,
  logAssistantAutofillAudit,
} from "../controllers/aiController.js";
import { protect } from "../middleware/authMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";
import aiGatewayRoutes from "./aiGatewayRoutes.js";

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
router.get("/assistant/context", getAssistantContext);
router.put("/assistant/profile", updateAssistantProfile);
router.post("/assistant/advice", getAssistantAdvice);
router.post("/assistant/chat", getAssistantChat);
router.post("/assistant/summarize", summarizeAssistantPage);
router.post("/assistant/clear-memory", clearAssistantMemory);
router.post("/assistant/autofill-audit", logAssistantAutofillAudit);
router.use("/gateway", aiGatewayRoutes);

export default router;
