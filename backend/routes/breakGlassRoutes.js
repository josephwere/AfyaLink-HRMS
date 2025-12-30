import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  activateBreakGlass,
  deactivateBreakGlass,
} from "../controllers/breakGlassController.js";

const router = express.Router();

router.post("/activate", protect, activateBreakGlass);
router.post("/deactivate", protect, deactivateBreakGlass);

export default router;
