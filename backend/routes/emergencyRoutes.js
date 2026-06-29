import express from "express";
import { activateEmergency, deactivateEmergency, listSessions, getSession, reviewSession } from "../controllers/emergencyController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// Activate emergency override (requires facility:emergency_override permission)
router.post("/activate", requirePermission("facility", "emergency_override"), activateEmergency);

// Deactivate emergency override (actor or super admin)
router.post("/deactivate", requirePermission("facility", "emergency_override"), deactivateEmergency);

// Sessions and reviews
router.get("/sessions", requireRole("HOSPITAL_ADMIN"), listSessions);
router.get("/sessions/:id", requireRole("HOSPITAL_ADMIN"), getSession);
router.patch("/sessions/:id/review", requireRole("HOSPITAL_ADMIN"), reviewSession);

export default router;
