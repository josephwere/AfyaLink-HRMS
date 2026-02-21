import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { encounterReadGuard } from "../middleware/encounterReadGuard.js";
import { abacGuard } from "../middleware/abacGuard.js";

import {
  exportMedicalReport,
  getReports,
  getMyReports,
  createReport,
  updateReport,
  deleteReport,
  regulatoryAutoReport,
} from "../controllers/reportsController.js";

const router = express.Router();

/* ======================================================
   📄 EXPORT MEDICAL REPORT (PDF)
====================================================== */
router.get(
  "/medical/:encounterId",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DOCTOR"),
  encounterReadGuard,
  abacGuard({ domain: "CLINICAL", resource: "report_export", action: "read", fallbackAllow: true }),
  exportMedicalReport
);

/* ======================================================
   📋 ADMIN: ALL REPORTS
====================================================== */
router.get(
  "/",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  abacGuard({ domain: "CLINICAL", resource: "report_export", action: "read", fallbackAllow: true }),
  getReports
);

/* ======================================================
   👤 MY REPORTS (Doctor / Patient)
====================================================== */
router.get(
  "/mine",
  protect,
  requireRole("DOCTOR", "PATIENT"),
  abacGuard({ domain: "CLINICAL", resource: "report_export", action: "read", fallbackAllow: true }),
  getMyReports
);

router.get(
  "/regulatory/auto",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER"),
  abacGuard({ domain: "CLINICAL", resource: "report_export", action: "read", fallbackAllow: true }),
  regulatoryAutoReport
);

/* ======================================================
   ➕ CREATE REPORT
====================================================== */
router.post(
  "/",
  protect,
  requireRole("DOCTOR"),
  createReport
);

/* ======================================================
   ✏️ UPDATE REPORT
====================================================== */
router.put(
  "/:id",
  protect,
  requireRole("DOCTOR"),
  updateReport
);

/* ======================================================
   🗑 DELETE REPORT
====================================================== */
router.delete(
  "/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  deleteReport
);

export default router;
