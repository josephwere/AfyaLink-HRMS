import fs from "fs/promises";
import path from "path";
import AuditLog from "../models/AuditLog.js";
import ComplianceLegalHold from "../models/ComplianceLegalHold.js";
import { logAudit } from "../services/auditService.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";

function normalizeRegion(value) {
  return String(value || "DEFAULT").trim().toUpperCase() || "DEFAULT";
}

async function listEvidencePacks() {
  const complianceDir = path.resolve(process.cwd(), "backend", "artifacts", "compliance");
  try {
    const entries = await fs.readdir(complianceDir, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();

    return Promise.all(
      folders.slice(0, 8).map(async (name) => {
        const manifestPath = path.join(complianceDir, name, "manifest.json");
        const readmePath = path.join(complianceDir, name, "README.md");
        let manifest = null;
        try {
          manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        } catch {
          manifest = null;
        }

        return {
          id: name,
          generatedAt: manifest?.generatedAt || name,
          hasManifest: Boolean(manifest),
          hasReadme: await fs
            .access(readmePath)
            .then(() => true)
            .catch(() => false),
          commandCount: Array.isArray(manifest?.commands) ? manifest.commands.length : 0,
        };
      })
    );
  } catch {
    return [];
  }
}

export async function getComplianceCenter(_req, res) {
  const settings = await getSystemSettingsDoc({ lean: true });
  const [activeHolds, recentHolds, evidencePacks, auditSummary] = await Promise.all([
    ComplianceLegalHold.find({ status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate("createdBy", "name email role")
      .lean(),
    ComplianceLegalHold.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("createdBy", "name email role")
      .populate("releasedBy", "name email role")
      .lean(),
    listEvidencePacks(),
    (async () => {
      const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [events7d, events30d, exportEvents30d, failures30d] = await Promise.all([
        AuditLog.countDocuments({ createdAt: { $gte: last7 } }),
        AuditLog.countDocuments({ createdAt: { $gte: last30 } }),
        AuditLog.countDocuments({ createdAt: { $gte: last30 }, action: /^EXPORT_/ }),
        AuditLog.countDocuments({ createdAt: { $gte: last30 }, success: false }),
      ]);
      return { events7d, events30d, exportEvents30d, failures30d };
    })(),
  ]);

  res.set("Cache-Control", "no-store");
  return res.json({
    settings: settings?.compliance || {},
    activeHolds,
    recentHolds,
    evidencePacks,
    auditSummary,
  });
}

export async function createComplianceLegalHold(req, res) {
  const settings = await getSystemSettingsDoc({ lean: true });
  const requireReason = settings?.compliance?.requireLegalHoldReason !== false;
  const {
    title,
    description = "",
    region = settings?.compliance?.defaultRegion || "DEFAULT",
    scopeType = "SYSTEM",
    scopeRef = "",
    legalBasis = "",
    retentionOverrideDays = null,
    notes = "",
  } = req.body || {};

  if (!String(title || "").trim()) {
    return res.status(400).json({ message: "Legal hold title is required" });
  }
  if (requireReason && !String(legalBasis || description || notes || "").trim()) {
    return res.status(400).json({ message: "Legal basis or reason is required for a legal hold" });
  }

  const hold = await ComplianceLegalHold.create({
    title: String(title).trim(),
    description: String(description || "").trim(),
    region: normalizeRegion(region),
    scopeType,
    scopeRef: String(scopeRef || "").trim(),
    legalBasis: String(legalBasis || "").trim(),
    retentionOverrideDays:
      retentionOverrideDays === null || retentionOverrideDays === ""
        ? null
        : Number(retentionOverrideDays),
    notes: String(notes || "").trim(),
    createdBy: req.user?._id || req.user?.id || null,
  });

  await logAudit({
    actorId: req.user?._id || req.user?.id || null,
    actorRole: req.user?.role || "",
    action: "COMPLIANCE_LEGAL_HOLD_CREATED",
    resource: "ComplianceLegalHold",
    resourceId: hold._id,
    after: hold.toObject(),
    metadata: {
      region: hold.region,
      scopeType: hold.scopeType,
      scopeRef: hold.scopeRef,
    },
    success: true,
  });

  return res.status(201).json({ hold });
}

export async function releaseComplianceLegalHold(req, res) {
  const hold = await ComplianceLegalHold.findById(req.params.id);
  if (!hold) {
    return res.status(404).json({ message: "Legal hold not found" });
  }
  if (hold.status === "RELEASED") {
    return res.json({ hold });
  }

  const before = hold.toObject();
  hold.status = "RELEASED";
  hold.releasedAt = new Date();
  hold.releasedBy = req.user?._id || req.user?.id || null;
  if (req.body?.notes) {
    hold.notes = [hold.notes, String(req.body.notes).trim()].filter(Boolean).join("\n");
  }
  await hold.save();

  await logAudit({
    actorId: req.user?._id || req.user?.id || null,
    actorRole: req.user?.role || "",
    action: "COMPLIANCE_LEGAL_HOLD_RELEASED",
    resource: "ComplianceLegalHold",
    resourceId: hold._id,
    before,
    after: hold.toObject(),
    metadata: {
      region: hold.region,
      scopeType: hold.scopeType,
      scopeRef: hold.scopeRef,
    },
    success: true,
  });

  return res.json({ hold });
}
