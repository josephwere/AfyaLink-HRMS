import express from "express";
import mongoose from "mongoose";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import PilotOnboardingChecklist from "../models/PilotOnboardingChecklist.js";

const router = express.Router();

const DEFAULT_ITEMS = [
  { key: "governance", title: "Governance and legal onboarding complete" },
  { key: "identity", title: "Admin identity and 2FA setup complete" },
  { key: "data_migration", title: "Initial data migration validated" },
  { key: "integrations", title: "FHIR/HL7 integrations smoke-tested" },
  { key: "training", title: "Role-based training completed" },
  { key: "dr_drill", title: "DR and incident drill completed" },
  { key: "go_live", title: "Go-live readiness sign-off" },
];

function normalizeHospitalScope(req, hospitalId) {
  const role = String(req.user?.effectiveRole || req.user?.role || "").toUpperCase();
  const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  return privileged ? hospitalId || null : req.user?.hospital || null;
}

function deriveStatus(items = []) {
  const total = items.length;
  const completed = items.filter((i) => i.completed).length;
  if (!total || completed === 0) return "NOT_STARTED";
  if (completed === total) return "COMPLETED";
  if (completed >= Math.ceil(total * 0.85)) return "READY_FOR_GO_LIVE";
  return "IN_PROGRESS";
}

router.use(
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER")
);

router.get("/onboarding", async (req, res) => {
  try {
    const hospital = normalizeHospitalScope(req, req.query.hospital || null);
    const filter = {};
    if (hospital) filter.hospital = hospital;
    const items = await PilotOnboardingChecklist.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    return res.json({ count: items.length, items });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list onboarding checklists" });
  }
});

router.post("/onboarding", async (req, res) => {
  try {
    const hospital = normalizeHospitalScope(req, req.body?.hospital || null);
    if (!hospital || !mongoose.Types.ObjectId.isValid(String(hospital))) {
      return res.status(422).json({ message: "Valid hospital is required" });
    }

    const incomingItems = Array.isArray(req.body?.items) ? req.body.items : DEFAULT_ITEMS;
    const sanitized = incomingItems.map((item) => ({
      key: String(item.key || "").trim(),
      title: String(item.title || "").trim(),
      completed: Boolean(item.completed),
      completedAt: item.completed ? new Date(item.completedAt || Date.now()) : null,
      completedBy: item.completed ? req.user._id : null,
      notes: String(item.notes || "").trim(),
    }));

    const status = req.body?.status || deriveStatus(sanitized);
    const doc = await PilotOnboardingChecklist.findOneAndUpdate(
      { hospital },
      {
        $set: {
          hospital,
          owner: req.body?.owner || req.user?._id || null,
          phase: String(req.body?.phase || "PILOT").toUpperCase(),
          status,
          items: sanitized,
          metadata: req.body?.metadata || {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to save onboarding checklist" });
  }
});

router.patch("/onboarding/:id/item/:key", async (req, res) => {
  try {
    const doc = await PilotOnboardingChecklist.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Checklist not found" });

    const hospital = normalizeHospitalScope(req, req.query.hospital || null);
    if (hospital && String(doc.hospital) !== String(hospital)) {
      return res.status(403).json({ message: "Forbidden hospital scope" });
    }

    const key = String(req.params.key || "").trim();
    const idx = doc.items.findIndex((item) => item.key === key);
    if (idx < 0) return res.status(404).json({ message: "Checklist item not found" });

    const completed =
      req.body?.completed === undefined ? !doc.items[idx].completed : Boolean(req.body.completed);
    doc.items[idx].completed = completed;
    doc.items[idx].completedAt = completed ? new Date() : null;
    doc.items[idx].completedBy = completed ? req.user._id : null;
    if (req.body?.notes !== undefined) doc.items[idx].notes = String(req.body.notes || "").trim();
    doc.status = deriveStatus(doc.items);
    await doc.save();

    return res.json({ ok: true, item: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to update onboarding item" });
  }
});

export default router;
