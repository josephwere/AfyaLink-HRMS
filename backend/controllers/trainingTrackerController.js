import mongoose from "mongoose";
import TrainingTracker from "../models/TrainingTracker.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { logAudit } from "../services/auditService.js";

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const TRAINER_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER"]);

function defaultDays() {
  return [
    { day: 1, title: "Day 1 - Orientation", completed: false, notes: "" },
    { day: 2, title: "Day 2 - Core Workflows", completed: false, notes: "" },
    { day: 3, title: "Day 3 - Safety & Compliance", completed: false, notes: "" },
    { day: 4, title: "Day 4 - Advanced Workflows", completed: false, notes: "" },
    { day: 5, title: "Day 5 - Cross-Team Practice", completed: false, notes: "" },
    { day: 6, title: "Day 6 - KPI Readiness", completed: false, notes: "" },
    { day: 7, title: "Day 7 - Final Validation", completed: false, notes: "" },
  ];
}

function computeProgress(days = []) {
  const total = Array.isArray(days) ? days.length : 0;
  if (!total) return { progressPercent: 0, status: "NOT_STARTED" };
  const completed = days.filter((d) => d?.completed).length;
  const progressPercent = Math.round((completed / total) * 100);
  if (completed === 0) return { progressPercent, status: "NOT_STARTED" };
  if (completed === total) return { progressPercent, status: "COMPLETED" };
  return { progressPercent, status: "IN_PROGRESS" };
}

function resolveHospitalScope(req, requestedHospital) {
  const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || "");
  const privileged = PRIVILEGED_ROLES.has(actorRole);
  if (privileged) {
    return requestedHospital || null;
  }
  return req.user?.hospital || null;
}

function canTrain(req) {
  const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || "");
  return TRAINER_ROLES.has(actorRole);
}

export async function listTrainingTrackers(req, res) {
  try {
    const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || "");
    if (!TRAINER_ROLES.has(actorRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const q = String(req.query?.q || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();
    const role = normalizeRole(String(req.query?.role || "").trim());
    const hospital = resolveHospitalScope(req, req.query?.hospital || null);
    const limit = Math.min(Math.max(Number(req.query?.limit || 60), 1), 200);

    const filter = {};
    if (hospital) filter.hospital = hospital;
    if (status && ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(status)) filter.status = status;
    if (role) filter.traineeRole = role;
    if (q) {
      filter.$or = [
        { traineeName: { $regex: q, $options: "i" } },
        { traineeEmail: { $regex: q, $options: "i" } },
      ];
    }

    const items = await TrainingTracker.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
      .populate("traineeUser", "name email role")
      .populate("assignedBy", "name email role")
      .lean();

    return res.json({ items });
  } catch (error) {
    console.error("listTrainingTrackers error", error);
    return res.status(500).json({ message: "Failed to load training trackers" });
  }
}

export async function upsertTrainingTracker(req, res) {
  try {
    if (!canTrain(req)) return res.status(403).json({ message: "Forbidden" });

    const body = req.body || {};
    const hospital = resolveHospitalScope(req, body.hospitalId || null);
    const traineeRole = normalizeRole(body.traineeRole || "");
    const traineeName = String(body.traineeName || "").trim();
    const traineeEmail = String(body.traineeEmail || "").trim().toLowerCase();
    const traineeUserId = body.traineeUserId && mongoose.Types.ObjectId.isValid(body.traineeUserId)
      ? String(body.traineeUserId)
      : null;

    if (!hospital) return res.status(400).json({ message: "hospitalId is required" });
    if (!traineeRole) return res.status(400).json({ message: "traineeRole is required" });

    let resolvedName = traineeName;
    let resolvedEmail = traineeEmail;
    let resolvedUserId = traineeUserId;
    if (traineeUserId) {
      const user = await User.findById(traineeUserId).select("name email role hospital").lean();
      if (!user) return res.status(404).json({ message: "Trainee user not found" });
      if (String(user.hospital || "") !== String(hospital)) {
        return res.status(400).json({ message: "Trainee must belong to the selected hospital" });
      }
      resolvedUserId = String(user._id);
      resolvedName = user.name || resolvedName;
      resolvedEmail = (user.email || resolvedEmail || "").toLowerCase();
    }

    if (!resolvedName) return res.status(400).json({ message: "traineeName is required" });

    const baseDays = Array.isArray(body.days) && body.days.length
      ? body.days.map((d, idx) => ({
          day: Number(d?.day || idx + 1),
          title: String(d?.title || `Day ${idx + 1}`).trim(),
          completed: Boolean(d?.completed),
          notes: String(d?.notes || "").trim(),
          completedAt: d?.completed ? new Date(d?.completedAt || Date.now()) : null,
          completedBy: d?.completed ? req.user?._id : null,
        }))
      : defaultDays();

    const withSevenDays = baseDays.slice(0, 7);
    while (withSevenDays.length < 7) {
      withSevenDays.push(defaultDays()[withSevenDays.length]);
    }
    const { progressPercent, status } = computeProgress(withSevenDays);

    const selector = resolvedUserId
      ? { hospital, traineeUser: resolvedUserId }
      : { hospital, traineeRole, traineeName: resolvedName, traineeEmail: resolvedEmail };

    const doc = await TrainingTracker.findOneAndUpdate(
      selector,
      {
        $set: {
          hospital,
          traineeUser: resolvedUserId,
          traineeName: resolvedName,
          traineeEmail: resolvedEmail,
          traineeRole,
          assignedBy: req.user?._id || null,
          days: withSevenDays,
          trainerNotes: String(body.trainerNotes || "").trim(),
          progressPercent,
          status,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "training.tracker.upsert",
      resource: "TRAINING_TRACKER",
      resourceId: String(doc._id),
      after: {
        traineeRole: doc.traineeRole,
        traineeUser: doc.traineeUser || null,
        progressPercent: doc.progressPercent,
        status: doc.status,
      },
      hospital,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
    });

    return res.status(201).json({ item: doc });
  } catch (error) {
    console.error("upsertTrainingTracker error", error);
    return res.status(500).json({ message: "Failed to save training tracker" });
  }
}

export async function setTrainingDay(req, res) {
  try {
    if (!canTrain(req)) return res.status(403).json({ message: "Forbidden" });
    const id = req.params?.id;
    const day = Number(req.params?.day);
    const body = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid tracker id" });
    }
    if (!Number.isFinite(day) || day < 1 || day > 7) {
      return res.status(400).json({ message: "Day must be between 1 and 7" });
    }

    const tracker = await TrainingTracker.findById(id);
    if (!tracker) return res.status(404).json({ message: "Tracker not found" });

    const hospitalScope = resolveHospitalScope(req, req.query?.hospital || null);
    if (hospitalScope && String(tracker.hospital || "") !== String(hospitalScope)) {
      return res.status(403).json({ message: "Forbidden for this hospital scope" });
    }

    if (!Array.isArray(tracker.days) || tracker.days.length === 0) tracker.days = defaultDays();
    const idx = tracker.days.findIndex((d) => Number(d.day) === day);
    if (idx < 0) return res.status(404).json({ message: "Day not found in tracker plan" });

    const completed = body.completed === undefined ? !tracker.days[idx].completed : Boolean(body.completed);
    tracker.days[idx].completed = completed;
    tracker.days[idx].completedAt = completed ? new Date() : null;
    tracker.days[idx].completedBy = completed ? req.user?._id : null;
    if (body.notes !== undefined) tracker.days[idx].notes = String(body.notes || "").trim();

    if (body.trainerNotes !== undefined) tracker.trainerNotes = String(body.trainerNotes || "").trim();
    const progress = computeProgress(tracker.days);
    tracker.progressPercent = progress.progressPercent;
    tracker.status = progress.status;

    await tracker.save();

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "training.tracker.day.update",
      resource: "TRAINING_TRACKER",
      resourceId: String(tracker._id),
      after: {
        day,
        completed,
        progressPercent: tracker.progressPercent,
        status: tracker.status,
      },
      hospital: tracker.hospital || null,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      success: true,
    });

    return res.json({ item: tracker });
  } catch (error) {
    console.error("setTrainingDay error", error);
    return res.status(500).json({ message: "Failed to update day progress" });
  }
}
