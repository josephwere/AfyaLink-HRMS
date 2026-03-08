import express from "express";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import {
  listRegisteredPharmacies,
  createRegisteredPharmacy,
  updateRegisteredPharmacy,
  createPharmacyReferral,
  listPharmacyReferrals,
  updatePharmacyReferral,
} from "../controllers/pharmacyNetworkController.js";

const router = express.Router();

router.use(protect);

router.get("/pharmacies", listRegisteredPharmacies);
router.post("/pharmacies", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), createRegisteredPharmacy);
router.put("/pharmacies/:id", requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"), updateRegisteredPharmacy);

router.get(
  "/referrals",
  requireRole("HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "PATIENT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  listPharmacyReferrals
);
router.post(
  "/referrals",
  requireRole("HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  createPharmacyReferral
);
router.patch(
  "/referrals/:id",
  requireRole("PHARMACIST", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  updatePharmacyReferral
);

export default router;
