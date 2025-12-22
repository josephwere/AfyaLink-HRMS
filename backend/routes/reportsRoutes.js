import express from "express";
import protect from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

import {
  exportMedicalReport,
  getReports,
  getMyReports,
  createReport,
  updateReport,
  deleteReport,
} from "../controllers/reportsController.js";

const router = express.Router();

/* ======================================================
   📄 EXPORT MEDICAL REPORT (PDF)
====================================================== */
router.get(
  "/medical/:encounterId",
  protect,
  authorize("doctor", "read"),
  exportMedicalReport
);

/* ======================================================
   📋 ADMIN: ALL REPORTS
====================================================== */
router.get(
  "/",
  protect,
  authorize("admin", "read"),
  getReports
);

/* ======================================================
   👤 MY REPORTS (Doctor / Patient)
====================================================== */
router.get(
  "/mine",
  protect,
  authorize("doctor", "read"),
  getMyReports
);

/* ======================================================
   ➕ CREATE REPORT
====================================================== */
router.post(
  "/",
  protect,
  authorize("doctor", "write"),
  createReport
);

/* ======================================================
   ✏️ UPDATE REPORT
====================================================== */
router.put(
  "/:id",
  protect,
  authorize("doctor", "write"),
  updateReport
);

/* ======================================================
   🗑 DELETE REPORT
====================================================== */
router.delete(
  "/:id",
  protect,
  authorize("admin", "write"),
  deleteReport
);

export default router;
