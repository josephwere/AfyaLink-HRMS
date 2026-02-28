import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import SreIncident from "../models/SreIncident.js";

const router = express.Router();
router.use(
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "SECURITY_ADMIN")
);

function nextIncidentKey() {
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2, 8);
  return `inc_${ts}_${rand}`;
}

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const severity = req.query.severity ? String(req.query.severity).toUpperCase() : null;
    const q = req.query.q ? String(req.query.q).trim() : "";

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (q) {
      filter.$or = [
        { incidentKey: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
        { sourceAlert: { $regex: q, $options: "i" } },
      ];
    }

    const incidents = await SreIncident.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ count: incidents.length, incidents });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list incidents" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { severity, service, summary, sourceAlert, runbookUrl, commsOwner, hospital } = req.body || {};
    if (!severity || !summary) {
      return res.status(422).json({ message: "severity and summary are required" });
    }

    const incident = await SreIncident.create({
      incidentKey: nextIncidentKey(),
      hospital: hospital || req.user?.hospital || null,
      service: service || "afyalink-backend",
      severity: String(severity).toUpperCase(),
      summary,
      sourceAlert: sourceAlert || "",
      runbookUrl: runbookUrl || "",
      commander: req.user._id,
      commsOwner: commsOwner || null,
      events: [{ type: "DECLARED", actor: req.user._id, note: sourceAlert || "Manual declaration" }],
    });

    return res.status(201).json({ ok: true, incident });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to declare incident" });
  }
});

router.post("/:id/ack", async (req, res) => {
  try {
    const { note = "" } = req.body || {};
    const incident = await SreIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    incident.status = "ACKED";
    incident.acknowledgedBy = req.user._id;
    incident.acknowledgedAt = new Date();
    incident.events.push({ type: "ACKED", actor: req.user._id, note });
    await incident.save();
    return res.json({ ok: true, incident });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to ack incident" });
  }
});

router.post("/:id/escalate", async (req, res) => {
  try {
    const { note = "", commsOwner } = req.body || {};
    const incident = await SreIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    if (commsOwner) incident.commsOwner = commsOwner;
    incident.events.push({ type: "ESCALATED", actor: req.user._id, note });
    await incident.save();
    return res.json({ ok: true, incident });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to escalate incident" });
  }
});

router.post("/:id/mitigate", async (req, res) => {
  try {
    const { note = "" } = req.body || {};
    const incident = await SreIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    incident.status = "MITIGATED";
    incident.mitigatedAt = new Date();
    incident.events.push({ type: "MITIGATED", actor: req.user._id, note });
    await incident.save();
    return res.json({ ok: true, incident });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to mark mitigated" });
  }
});

router.post("/:id/resolve", async (req, res) => {
  try {
    const { note = "" } = req.body || {};
    const incident = await SreIncident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    incident.status = "RESOLVED";
    incident.resolvedAt = new Date();
    incident.events.push({ type: "RESOLVED", actor: req.user._id, note });
    await incident.save();
    return res.json({ ok: true, incident });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to resolve incident" });
  }
});

export default router;
