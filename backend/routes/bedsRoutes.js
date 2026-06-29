import express from "express";
import {
  listBeds,
  updateBed,
  createBed,
  transferBed,
  dischargeBed,
  getBedTimeline,
  listWards,
  createWard,
} from "../controllers/bedsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requirePermission, requireRole } from "../middleware/roleMiddleware.js";
const router = express.Router();

router.use(protect);

router.get("/wards", requirePermission("wards", "read"), listWards);
router.post("/wards", requirePermission("wards", "create"), createWard);
router.get("/", requirePermission("beds", "read"), listBeds);
router.get("/:id/timeline", requirePermission("beds", "read"), getBedTimeline);
router.post("/", requirePermission("beds", "create"), createBed);
router.post("/:id/transfer", requirePermission("beds", "transfer"), transferBed);
router.post("/:id/discharge", requirePermission("beds", "discharge"), dischargeBed);
router.put("/:id", requirePermission("beds", "update"), updateBed);

export default router;
