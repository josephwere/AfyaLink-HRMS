import mongoose from "mongoose";
import LabOpsRecord from "../models/LabOpsRecord.js";
import {
  sanitizeCode,
  sanitizeObjectTree,
  sanitizeString,
} from "../utils/securitySanitizers.js";

const ALLOWED_KINDS = new Set([
  "SAMPLE_TRACKING",
  "EQUIPMENT_LOG",
  "QUALITY_CONTROL",
  "SAFETY_CHECK",
]);

function resolveHospitalId(req) {
  const role = String(req.user?.effectiveRole || req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.body?.hospitalId || req.user?.hospitalId || req.user?.hospital || null;
  }
  return req.user?.hospitalId || req.user?.hospital || null;
}

function normalizeKind(value) {
  const next = sanitizeCode(value || "");
  return ALLOWED_KINDS.has(next) ? next : "";
}

function normalizeStatus(value, fallback = "OPEN") {
  return sanitizeCode(value || fallback) || fallback;
}

function toObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function listLabOpsRecords(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const kind = normalizeKind(req.query?.kind || "");
    const status = req.query?.status ? normalizeStatus(req.query.status) : "";
    const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 250);
    const filter = {
      hospital: hospitalId,
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
    };

    const hospitalObjectId = toObjectId(hospitalId);
    const baseSummaryMatch = hospitalObjectId ? { hospital: hospitalObjectId } : { hospital: hospitalId };
    const statusSummaryMatch = {
      ...baseSummaryMatch,
      ...(kind ? { kind } : {}),
    };

    const [items, total, byStatus, byKind] = await Promise.all([
      LabOpsRecord.find(filter)
        .sort({ observedAt: -1, createdAt: -1 })
        .limit(limit)
        .populate("createdBy", "name role")
        .lean(),
      LabOpsRecord.countDocuments(filter),
      LabOpsRecord.aggregate([
        { $match: statusSummaryMatch },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
      LabOpsRecord.aggregate([
        { $match: baseSummaryMatch },
        {
          $group: {
            _id: "$kind",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

    return res.json({
      items,
      total,
      limit,
      summary: {
        byStatus: byStatus.map((row) => ({
          status: row._id || "UNKNOWN",
          count: row.count || 0,
        })),
        byKind: byKind.map((row) => ({
          kind: row._id || "UNKNOWN",
          count: row.count || 0,
        })),
      },
    });
  } catch (err) {
    console.error("List lab ops records error:", err);
    return res.status(500).json({ message: "Failed to load lab operations records" });
  }
}

export async function createLabOpsRecord(req, res) {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "hospitalId is required for this role" });
    }

    const kind = normalizeKind(req.body?.kind || "");
    const title = sanitizeString(req.body?.title || "", { maxLength: 160 });
    const reference = sanitizeString(req.body?.reference || "", { maxLength: 160 });
    const status = normalizeStatus(req.body?.status || "OPEN");
    const note = sanitizeString(req.body?.note || "", {
      maxLength: 1000,
      preserveNewlines: true,
    });
    const safeDetails = sanitizeObjectTree(req.body?.details);
    const observedAt = req.body?.observedAt ? new Date(req.body.observedAt) : new Date();

    if (!kind) {
      return res.status(400).json({ message: "A valid lab operations record type is required." });
    }

    if (!title) {
      return res.status(400).json({ message: "A title is required for this record." });
    }

    const item = await LabOpsRecord.create({
      hospital: hospitalId,
      kind,
      title,
      reference,
      status,
      note,
      observedAt: Number.isNaN(observedAt.getTime()) ? new Date() : observedAt,
      details: safeDetails && typeof safeDetails === "object" ? safeDetails : {},
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    const populated = await LabOpsRecord.findById(item._id)
      .populate("createdBy", "name role")
      .lean();

    return res.status(201).json({ item: populated || item });
  } catch (err) {
    console.error("Create lab ops record error:", err);
    return res.status(500).json({ message: "Failed to save lab operations record" });
  }
}
