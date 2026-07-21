import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  applyEncounterCloseoutEffects,
  bulkAssignEncounterEscalations,
  bulkReviewEncounterEscalations,
  bulkResolveEncounterEscalations,
  createEncounterBillingHandoff,
  createRuntimeEncounter,
  joinRuntimeEncounter,
  listEncounterEscalations,
  createNurseEscalation,
  closeEncounter,
  listEncounters,
  resolveNurseEscalation,
  startRuntimeEncounter,
} from "../controllers/encounterController.js";

const router = express.Router();

router.get(
  "/escalations",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR"),
  listEncounterEscalations
);

router.post(
  "/escalations/bulk-resolve",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR"),
  bulkResolveEncounterEscalations
);

router.post(
  "/escalations/bulk-assign",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"),
  bulkAssignEncounterEscalations
);

router.post(
  "/escalations/bulk-review",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DOCTOR"),
  bulkReviewEncounterEscalations
);

router.post(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  createRuntimeEncounter
);

router.post(
  "/:id/join",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "PATIENT"),
  joinRuntimeEncounter
);

router.post(
  "/:id/start",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  startRuntimeEncounter
);

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
    "PHARMACIST",
    "PATIENT"
  ),
  listEncounters
);

router.post(
  "/:id/closeout-effects",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  applyEncounterCloseoutEffects
);

router.post(
  "/:id/billing-handoff",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  createEncounterBillingHandoff
);

router.post(
  "/:id/nurse-escalation",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "NURSE"),
  createNurseEscalation
);

router.post(
  "/:id/nurse-escalation-resolve",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  resolveNurseEscalation
);

router.post(
  "/:id/close",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "DOCTOR"),
  closeEncounter
);

export default router;
