import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { closeEncounter, listEncounters } from "../controllers/encounterController.js";

const router = express.Router();

router.get(
  "/",
  protect,
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "HOSPITAL_ADMIN",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST"
  ),
  listEncounters
);

router.post(
  "/:id/close",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  closeEncounter
);

export default router;
