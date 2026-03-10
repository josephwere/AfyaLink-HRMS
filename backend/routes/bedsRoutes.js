import express from "express";
import { listBeds, updateBed, createBed, transferBed, dischargeBed, getBedTimeline } from "../controllers/bedsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
const router = express.Router();

router.use(protect);

router.get("/", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "NURSE", "DOCTOR"), listBeds);
router.get("/:id/timeline", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "NURSE", "DOCTOR"), getBedTimeline);
router.post("/", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"), createBed);
router.post("/:id/transfer", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "NURSE"), transferBed);
router.post("/:id/discharge", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "NURSE"), dischargeBed);
router.put("/:id", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "NURSE"), updateBed);

export default router;
