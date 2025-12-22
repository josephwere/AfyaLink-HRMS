import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";

import {
  exportMedicalReport,
  getReports,
  getMyReports,
  createReport,
  updateReport,
  deleteReport,
} from "../controllers/reportController.js";

const router = express.Router();

/* ======================================================
   🔐 AUTHENTICATION
====================================================== */
router.use(authenticate);

/* ======================================================
   📄 MEDICAL / MEDICO-LEGAL PDF EXPORT
====================================================== */
router.get(
  "/medical/:encounterId",
  authorize(["Admin", "Doctor"]),
  exportMedicalReport
);

/* ======================================================
   📋 REPORT LISTING
====================================================== */
router.get(
  "/",
  authorize(["Admin"]),
  getReports
);

router.get(
  "/mine",
  authorize(["Doctor", "Patient"]),
  getMyReports
);

/* ======================================================
   ➕ CREATE REPORT
====================================================== */
router.post(
  "/",
  authorize(["Doctor", "Admin"]),
  createReport
);

/* ======================================================
   ✏️ UPDATE REPORT
====================================================== */
router.put(
  "/:id",
  authorize(["Doctor", "Admin"]),
  updateReport
);

/* ======================================================
   🗑 DELETE REPORT
====================================================== */
router.delete(
  "/:id",
  authorize(["Admin"]),
  deleteReport
);

export default router;
