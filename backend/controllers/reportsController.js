import Encounter from "../models/Encounter.js";
import Workflow from "../models/Workflow.js";
import AuditLog from "../models/AuditLog.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { recordExportEvent } from "../utils/exportAudit.js";

import { generateMedicalReport } from "../services/medicalReportService.js";
import { getIO } from "../utils/socket.js";

/* ======================================================
   📄 EXPORT MEDICAL / MEDICO-LEGAL REPORT (PDF)
====================================================== */
export const exportMedicalReport = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    if (!["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "DOCTOR"].includes(role)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { encounterId } = req.params;

    const encounter = await Encounter.findById(encounterId)
      .populate("patient")
      .populate("hospital");

    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    if (!privileged && String(encounter.hospital._id) !== String(req.user.hospital || req.user.hospitalId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const workflow = await Workflow.findById(encounter.workflow);

    const audit = await AuditLog.find({
      resourceId: workflow?._id,
    })
      .sort({ createdAt: 1 })
      .limit(2000);

    const pdf = generateMedicalReport({
      encounter,
      workflow,
      audit,
      hospital: encounter.hospital,
    });

    await recordExportEvent({
      req,
      action: "EXPORT_MEDICAL_REPORT_PDF",
      resource: "Encounter",
      resourceId: encounter._id,
      format: "PDF",
      metadata: { workflowId: workflow?._id || null },
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
    const role = normalizeRole(req.user.role);
    if (!["HOSPITAL_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const cursorMode =
      req.query.cursorMode === "1" ||
      req.query.cursorMode === "true" ||
      Object.prototype.hasOwnProperty.call(req.query, "cursor");
    const filter = { hospital: req.user.hospital };

    if (cursorMode) {
      let cursorFilter = { ...filter };
      if (cursor) {
        const parsed = decodeCursor(cursor);
        if (!parsed?.createdAt || !parsed?._id) {
          return res.status(400).json({ message: "Invalid cursor" });
        }
        cursorFilter = {
          ...filter,
          $or: [
            { createdAt: { $lt: new Date(parsed.createdAt) } },
            { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
          ],
        };
      }
      const rows = await Report.find(cursorFilter)
        .populate("patient createdBy")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("patient createdBy")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Report.countDocuments(filter),
    ]);

    res.json({ items: reports, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ======================================================
   👤 GET MY REPORTS (Doctor / Patient)
====================================================== */
export const getMyReports = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    const filter = { hospital: req.user.hospital };

    if (role === "DOCTOR") filter.createdBy = req.user._id;
    if (role === "PATIENT") filter.patient = req.user._id;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const cursorMode =
      req.query.cursorMode === "1" ||
      req.query.cursorMode === "true" ||
      Object.prototype.hasOwnProperty.call(req.query, "cursor");

    if (cursorMode) {
      let cursorFilter = { ...filter };
      if (cursor) {
        const parsed = decodeCursor(cursor);
        if (!parsed?.createdAt || !parsed?._id) {
          return res.status(400).json({ message: "Invalid cursor" });
        }
        cursorFilter = {
          ...filter,
          $or: [
            { createdAt: { $lt: new Date(parsed.createdAt) } },
            { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
          ],
        };
      }
      const rows = await Report.find(cursorFilter)
        .populate("patient createdBy")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("patient createdBy")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Report.countDocuments(filter),
    ]);

    res.json({ items: reports, total, page, limit });
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

export const regulatoryAutoReport = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    if (!["HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const hospital = req.user?.hospital || req.user?.hospitalId || null;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const hospitalFilter = hospital ? { hospital } : {};

    const [staffTotal, inactiveStaff, pendingLeave, pendingOvertime, pendingShifts, recentExports, recentAbacDenied] =
      await Promise.all([
        User.countDocuments({ ...hospitalFilter, role: { $nin: ["PATIENT", "GUEST"] } }),
        User.countDocuments({ ...hospitalFilter, role: { $nin: ["PATIENT", "GUEST"] }, active: false }),
        LeaveRequest.countDocuments({ ...hospitalFilter, status: "PENDING" }),
        OvertimeRequest.countDocuments({ ...hospitalFilter, status: "PENDING" }),
        ShiftRequest.countDocuments({ ...hospitalFilter, status: "PENDING" }),
        AuditLog.countDocuments({
          createdAt: { $gte: since },
          action: { $in: ["EXPORT_MEDICAL_REPORT_PDF", "EXPORT_TRANSACTIONS_CSV", "TRANSFER_FHIR_EXPORTED", "TRANSFER_HL7_EXPORTED"] },
          ...(hospital ? { hospital } : {}),
        }),
        AuditLog.countDocuments({
          createdAt: { $gte: since },
          action: "ABAC_DENIED",
          ...(hospital ? { hospital } : {}),
        }),
      ]);

    const report = {
      generatedAt: new Date().toISOString(),
      window: "last_30_days",
      hospital: hospital || "GLOBAL",
      workforce: {
        staffTotal,
        inactiveStaff,
        inactiveRate: staffTotal > 0 ? Number(((inactiveStaff / staffTotal) * 100).toFixed(2)) : 0,
      },
      approvals: {
        pendingLeave,
        pendingOvertime,
        pendingShifts,
        total: pendingLeave + pendingOvertime + pendingShifts,
      },
      compliance: {
        exportEvents: recentExports,
        abacDeniedEvents: recentAbacDenied,
      },
      flags: [
        ...(inactiveStaff > 0 ? ["inactive_staff_present"] : []),
        ...(pendingLeave + pendingOvertime + pendingShifts > 50 ? ["approval_backlog_high"] : []),
        ...(recentAbacDenied > 0 ? ["abac_denials_detected"] : []),
      ],
    };

    return res.json({ ok: true, report });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
