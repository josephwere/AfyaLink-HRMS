import Encounter from "../models/Encounter.js";
import Workflow from "../models/Workflow.js";
import AuditLog from "../models/AuditLog.js";
import Report from "../models/Report.js";

import { generateMedicalReport } from "../services/medicalReportService.js";
import { getIO } from "../utils/socket.js";

/* ======================================================
   📄 EXPORT MEDICAL / MEDICO-LEGAL REPORT (PDF)
====================================================== */
export const exportMedicalReport = async (req, res) => {
  try {
    if (!["Admin", "Doctor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { encounterId } = req.params;

    const encounter = await Encounter.findById(encounterId)
      .populate("patient")
      .populate("hospital");

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    if (String(encounter.hospital._id) !== String(req.user.hospital)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const workflow = await Workflow.findById(encounter.workflow);

    const audit = await AuditLog.find({
      resourceId: workflow?._id,
    }).sort({ at: 1 });

    const pdf = generateMedicalReport({
      encounter,
      workflow,
      audit,
      hospital: encounter.hospital,
    });

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
      "Content-Disposition",
      `attachment; filename=medical-report-${encounterId}.pdf`
    );

    pdf.pipe(res);
    pdf.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   📋 GET ALL REPORTS (Admin)
====================================================== */
export const getReports = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const reports = await Report.find({
      hospital: req.user.hospital,
    })
      .populate("patient createdBy")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   👤 GET MY REPORTS (Doctor / Patient)
====================================================== */
export const getMyReports = async (req, res) => {
  try {
    const filter = { hospital: req.user.hospital };

    if (req.user.role === "Doctor") filter.createdBy = req.user._id;
    if (req.user.role === "Patient") filter.patient = req.user._id;

    const reports = await Report.find(filter)
      .populate("patient createdBy")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   ➕ CREATE REPORT
====================================================== */
export const createReport = async (req, res) => {
  try {
    const report = await Report.create({
      ...req.body,
      createdBy: req.user._id,
      hospital: req.user.hospital,
    });

    getIO()
      .to(`hospital:${req.user.hospital}`)
      .emit("notification", {
        type: "REPORT_CREATED",
        reportId: report._id,
      });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   ✏️ UPDATE REPORT
====================================================== */
export const updateReport = async (req, res) => {
  try {
    const report = await Report.findOneAndUpdate(
      { _id: req.params.id, hospital: req.user.hospital },
      req.body,
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    getIO()
      .to(`hospital:${req.user.hospital}`)
      .emit("notification", {
        type: "REPORT_UPDATED",
        reportId: report._id,
      });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   🗑 DELETE REPORT
====================================================== */
export const deleteReport = async (req, res) => {
  try {
    const report = await Report.findOneAndDelete({
      _id: req.params.id,
      hospital: req.user.hospital,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    getIO()
      .to(`hospital:${req.user.hospital}`)
      .emit("notification", {
        type: "REPORT_DELETED",
        reportId: report._id,
      });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
