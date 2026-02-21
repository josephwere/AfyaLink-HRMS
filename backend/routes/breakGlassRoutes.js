import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRecentStepUp } from "../middleware/riskAdaptiveAuth.js";
import {
  activateBreakGlass,
  deactivateBreakGlass,
} from "../controllers/breakGlassController.js";

const router = express.Router();

router.post("/activate", protect, requireRecentStepUp(10), activateBreakGlass);
router.post("/deactivate", protect, requireRecentStepUp(10), deactivateBreakGlass);

export default router;
