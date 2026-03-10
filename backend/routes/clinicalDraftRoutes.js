import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getClinicalDraft,
  saveClinicalDraft,
  promoteClinicalDraft,
} from "../controllers/clinicalDraftController.js";

const router = express.Router();

router.use(protect);
router.use(requireRole("DOCTOR", "SURGEON", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"));

router.get("/:type", getClinicalDraft);
router.put("/:type", saveClinicalDraft);
router.post("/:type/promote", promoteClinicalDraft);

export default router;
