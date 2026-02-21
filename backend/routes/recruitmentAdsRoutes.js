import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";
import {
  createRecruitmentAd,
  listRecruitmentAds,
  updateRecruitmentAd,
  applyToRecruitmentAd,
  listRecruitmentApplications,
  updateRecruitmentApplicationStatus,
} from "../controllers/recruitmentAdsController.js";

const router = express.Router();

router.use(protect);

// Viewing is free for all authenticated roles.
router.get(
  "/",
  requireRole(
    "PATIENT",
    "GUEST",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "HOSPITAL_ADMIN",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DEVELOPER"
  ),
  listRecruitmentAds
);

// Posting/updating is premium gated.
router.post(
  "/",
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  planGuard({ feature: "recruitmentAds" }),
  createRecruitmentAd
);

router.patch(
  "/:id",
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  planGuard({ feature: "recruitmentAds" }),
  updateRecruitmentAd
);

router.post(
  "/:id/apply",
  requireRole(
    "PATIENT",
    "GUEST",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "HOSPITAL_ADMIN",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DEVELOPER"
  ),
  applyToRecruitmentAd
);

router.get(
  "/applications",
  requireRole(
    "PATIENT",
    "GUEST",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "HOSPITAL_ADMIN",
    "SYSTEM_ADMIN",
    "SUPER_ADMIN",
    "DEVELOPER"
  ),
  listRecruitmentApplications
);

router.patch(
  "/applications/:applicationId/status",
  requireRole("HOSPITAL_ADMIN", "HR_MANAGER", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  updateRecruitmentApplicationStatus
);

export default router;
