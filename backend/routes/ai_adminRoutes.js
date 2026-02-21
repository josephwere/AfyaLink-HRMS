import express from "express";
import { index, list } from "../controllers/ai_adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
const router = express.Router();

router.get("/", protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), index);
router.get(
  "/list",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  list
);

export default router;
