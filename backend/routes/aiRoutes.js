// backend/routes/aiRoutes.js

import express from "express";
import multer from "multer";
import {
  extractDocument,
  getAssistantContext,
  getAssistantChat,
  streamAssistantChatResponse,
  submitAssistantChatFeedback,
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

router.post("/extract", upload.single("file"), extractDocument);
router.get("/assistant/context", getAssistantContext);
router.post("/assistant/chat", getAssistantChat);
router.post("/assistant/chat/stream", streamAssistantChatResponse);
router.post("/assistant/feedback", submitAssistantChatFeedback);
router.post("/assistant/clear-memory", clearAssistantMemory);
router.post("/assistant/autofill-audit", logAssistantAutofillAudit);
router.use("/gateway", aiGatewayRoutes);

export default router;
