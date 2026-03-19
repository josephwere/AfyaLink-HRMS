import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getUnifiedAssistantOverview,
  getUnifiedAssistantSettings,
  updateUnifiedAssistantSettings,
  createUnifiedAssistantHandoffLog,
  searchUnifiedAssistant,
  getUnifiedAssistantRecord,
} from "../controllers/unifiedAssistantController.js";

const router = express.Router();

router.use(
  protect,
  requireRole("SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER")
);

router.get("/overview", getUnifiedAssistantOverview);
router.get("/settings", getUnifiedAssistantSettings);
router.patch("/settings", updateUnifiedAssistantSettings);
router.post("/handoff-log", createUnifiedAssistantHandoffLog);
router.get("/search", searchUnifiedAssistant);
router.get("/record/:kind/:id", getUnifiedAssistantRecord);

export default router;
