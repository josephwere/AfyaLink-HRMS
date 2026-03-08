import express from "express";
import multer from "multer";
import { protect, protectOptional } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { planGuard } from "../middleware/planGuard.js";
import {
  createRecruitmentAd,
  listRecruitmentAds,
  updateRecruitmentAd,
  applyToRecruitmentAd,
  trackRecruitmentAdEvent,
  listRecruitmentApplications,
  updateRecruitmentApplicationStatus,
} from "../controllers/recruitmentAdsController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 7 },
});

// Public careers listing supports guest access; role-scoped write/apply routes remain protected.
router.get(
  "/",
  protectOptional,
  listRecruitmentAds
);

// Posting/updating is premium gated.
router.post(
  "/",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  planGuard({ feature: "recruitmentAds" }),
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 6 },
  ]),
  createRecruitmentAd
);

router.patch(
  "/:id",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  planGuard({ feature: "recruitmentAds" }),
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 6 },
  ]),
  updateRecruitmentAd
);

router.post(
  "/:id/apply",
  protect,
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
  upload.fields([{ name: "resumeFile", maxCount: 1 }]),
  applyToRecruitmentAd
);

router.post(
  "/:id/track",
  protectOptional,
  trackRecruitmentAdEvent
);

router.get(
  "/applications",
  protect,
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
  protect,
  requireRole("HOSPITAL_ADMIN", "HR_MANAGER", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  updateRecruitmentApplicationStatus
);

export default router;
