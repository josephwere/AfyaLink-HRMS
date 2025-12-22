import Encounter from "../models/Encounter.js";
import Workflow from "../models/Workflow.js";
import AuditLog from "../models/AuditLog.js";
import Report from "../models/Report.js";

import { generateMedicalReport } from "../services/medicalReportService.js";
import { io } from "../server.js";

/* ======================================================
   📄 EXPORT MEDICAL / MEDICO-LEGAL REPORT (PDF)
   GET /api/reports/medical/:encounterId
   🔒 Read-only
   ⚖️ Legally defensible
====================================================== */
export const exportMedicalReport = async (req, res) => {
  try {
    /* =========================
       ROLE GUARD
    ========================== */
    if (!["Admin", "Doctor"].includes(req.user.role)) {
      return res.status(403).json({
        error: "Not authorized to export medical reports",
      });
    }

    const { encounterId } = req.params;

    const encounter = await Encounter.findById(encounterId)
      .populate("patient")
      .populate("hospital");

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    /* =========================
       TENANT ISOLATION
    ========================== */
    if (String(encounter.hospital._id) !== String(req.user.hospital)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const workflow = await Workflow.findById(encounter.workflow);

    const audit = await AuditLog.find({
      resourceId: workflow?._id,
    }).sort({ at: 1 });

    /* =========================
       GENERATE PDF
    ========================== */
    const pdf = generateMedicalReport({
      encounter,
      workflow,
      audit,
      hospital: encounter.hospital,
    });

    /* =========================
       AUDIT EXPORT (LEGAL)
    ========================== */
    await AuditLog.create({
      resourceId: encounter._id,
      resourceType: "MEDICAL_REPORT",
      action: "EXPORT_PDF",
      actor: req.user._id,
      actorRole: req.user.role,
      hospital: req.user.hospital,
      at: new Date(),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition
