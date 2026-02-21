import express from "express";
import { listBeds, updateBed, createBed } from "../controllers/bedsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
const router = express.Router();

router.use(protect);
router.use(requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"));

router.get("/", listBeds);
router.post("/", createBed);
router.put("/:id", updateBed);

export default router;
