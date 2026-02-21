import PrinterProfile from "../models/PrinterProfile.js";
import PrintJob from "../models/PrintJob.js";
import AuditLog from "../models/AuditLog.js";

const ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
]);

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function resolveHospital(req) {
  const role = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
  const isGlobal = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  const requested =
    req.query?.hospitalId || req.body?.hospitalId || req.params?.hospitalId || null;
  if (isGlobal && requested) return requested;
  return req.user?.hospitalId || req.user?.hospital || null;
}

async function writeAudit(req, action, metadata = {}, success = true, error = "") {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.actualRole || req.user?.role,
      action,
      resource: "Printing",
      hospital: resolveHospital(req),
      success,
      error: error || undefined,
      metadata,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  } catch {
    // no-op
  }
}

function buildPrintableHtml({ title, documentType, payload }) {
  const safeTitle = esc(title || documentType || "Document");
  const entries = Object.entries(payload || {});
  const rows = entries
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:24px;color:#111}
    h1{font-size:20px;margin:0 0 8px}
    .meta{font-size:12px;color:#555;margin-bottom:16px}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ddd;padding:8px;font-size:12px;vertical-align:top}
    th{background:#f6f6f6;text-align:left}
  </style></head><body>
  <h1>${safeTitle}</h1>
  <div class="meta">Type: ${esc(documentType || "GENERAL")} • Generated: ${new Date().toISOString()}</div>
  <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`;
}

export const listPrinterProfiles = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });

    const items = await PrinterProfile.find({ hospital })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load printer profiles" });
  }
};

export const createPrinterProfile = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
    const role = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
    if (!ADMIN_ROLES.has(role)) return res.status(403).json({ message: "Forbidden" });

    const payload = {
      hospital,
      name: req.body?.name,
      provider: req.body?.provider || "BROWSER",
      location: req.body?.location || "",
      description: req.body?.description || "",
      isDefault: Boolean(req.body?.isDefault),
      enabled: req.body?.enabled !== false,
      config: req.body?.config || {},
      createdBy: req.user?._id,
    };
    if (!payload.name) return res.status(400).json({ message: "Printer name is required" });

    if (payload.isDefault) {
      await PrinterProfile.updateMany({ hospital }, { $set: { isDefault: false } });
    }
    const created = await PrinterProfile.create(payload);
    await writeAudit(req, "PRINT_PROFILE_CREATE", { printerProfileId: created._id, provider: created.provider });
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to create printer profile" });
  }
};

export const updatePrinterProfile = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
    const role = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
    if (!ADMIN_ROLES.has(role)) return res.status(403).json({ message: "Forbidden" });

    const current = await PrinterProfile.findOne({ _id: req.params.id, hospital });
    if (!current) return res.status(404).json({ message: "Printer profile not found" });

    const updates = {};
    ["name", "provider", "location", "description"].forEach((k) => {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k];
    });
    if (req.body?.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
    if (req.body?.isDefault !== undefined) updates.isDefault = Boolean(req.body.isDefault);
    if (req.body?.config && typeof req.body.config === "object") {
      updates.config = { ...(current.config || {}), ...req.body.config };
    }

    if (updates.isDefault) {
      await PrinterProfile.updateMany({ hospital }, { $set: { isDefault: false } });
    }

    const updated = await PrinterProfile.findOneAndUpdate(
      { _id: req.params.id, hospital },
      { $set: updates },
      { new: true }
    );
    await writeAudit(req, "PRINT_PROFILE_UPDATE", { printerProfileId: updated?._id, updates: Object.keys(updates) });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update printer profile" });
  }
};

export const listPrintJobs = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const items = await PrintJob.find({ hospital })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("printerProfile", "name provider")
      .populate("createdBy", "name email")
      .lean();
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load print jobs" });
  }
};

export const queuePrintJob = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
    const { printerProfileId, documentType, title, payload, copies } = req.body || {};
    if (!printerProfileId || !documentType) {
      return res.status(400).json({ message: "printerProfileId and documentType are required" });
    }

    const printer = await PrinterProfile.findOne({ _id: printerProfileId, hospital, enabled: true });
    if (!printer) return res.status(404).json({ message: "Printer profile not found or disabled" });

    const created = await PrintJob.create({
      hospital,
      printerProfile: printer._id,
      createdBy: req.user?._id,
      status: printer.provider === "BROWSER" || printer.provider === "PDF" ? "SENT" : "QUEUED",
      documentType,
      title: title || "",
      payload: payload && typeof payload === "object" ? payload : {},
      copies: Math.min(Math.max(parseInt(copies || "1", 10), 1), 20),
    });

    await writeAudit(req, "PRINT_JOB_CREATE", {
      printJobId: created._id,
      printerProfileId: printer._id,
      provider: printer.provider,
      documentType,
      copies: created.copies,
    });

    const printableHtml = buildPrintableHtml({
      title,
      documentType,
      payload: created.payload,
    });

    return res.status(201).json({
      job: created,
      printer: { _id: printer._id, name: printer.name, provider: printer.provider },
      printableHtml,
    });
  } catch (err) {
    await writeAudit(req, "PRINT_JOB_CREATE", { error: err?.message }, false, err?.message || "print queue error");
    return res.status(500).json({ message: "Failed to queue print job" });
  }
};

export const updatePrintJobStatus = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context missing" });
    const role = String(req.user?.actualRole || req.user?.role || "").toUpperCase();
    if (!ADMIN_ROLES.has(role)) return res.status(403).json({ message: "Forbidden" });

    const status = String(req.body?.status || "").toUpperCase();
    if (!["QUEUED", "SENT", "PRINTED", "FAILED", "CANCELED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updates = {
      status,
      error: req.body?.error || "",
    };
    if (status === "PRINTED") updates.printedAt = new Date();

    const item = await PrintJob.findOneAndUpdate(
      { _id: req.params.id, hospital },
      { $set: updates },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Print job not found" });

    await writeAudit(req, "PRINT_JOB_STATUS_UPDATE", {
      printJobId: item._id,
      status: item.status,
    });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update print job status" });
  }
};

export const getPrintingConnectors = async (_req, res) => {
  return res.json({
    connectors: {
      browser: { enabled: true, description: "Built-in browser print dialog" },
      pdf: { enabled: true, description: "Generate printable document and save as PDF" },
      qzTray: { enabled: Boolean(process.env.QZ_TRAY_BRIDGE_URL), bridgeUrl: process.env.QZ_TRAY_BRIDGE_URL || "" },
      ipp: { enabled: true, description: "Use IPP URL in printer profile config" },
      cups: { enabled: Boolean(process.env.CUPS_BRIDGE_URL), bridgeUrl: process.env.CUPS_BRIDGE_URL || "" },
    },
  });
};

