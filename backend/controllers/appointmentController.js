import workflowService from "../services/workflowService.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

async function resolvePatientIdsForUser(userId, hospitalId = null) {
  const user = await User.findById(userId).select("name phone nationalIdNumber");
  if (!user) return [];

  const filters = [];
  if (user.nationalIdNumber) filters.push({ nationalId: user.nationalIdNumber });
  if (user.phone) filters.push({ contact: user.phone });
  filters.push({ "metadata.userId": userId });
  if (!filters.length) return [];

  const where = {
    active: true,
    $or: filters,
  };
  if (hospitalId) where.hospital = hospitalId;

  const rows = await Patient.find(where).select("_id");
  return rows.map((p) => String(p._id));
}

/* ======================================================
   CREATE APPOINTMENT (WORKFLOW ENTRY)
====================================================== */
export const createAppointment = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestedHospitalId = req.body?.hospitalId || null;
    const hospitalId = requestedHospitalId || req.user.hospitalId || req.user.hospital || null;
    let { patient, doctor, scheduledAt, reason } = req.body;

    if (role === "PATIENT") {
      const ownPatientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      if (patient && !ownPatientIds.includes(String(patient))) {
        return res.status(403).json({ msg: "You can only create appointments for your own patient profile" });
      }
      if (!patient) {
        if (ownPatientIds.length) {
          patient = ownPatientIds[0];
        } else {
          if (!hospitalId) {
            return res.status(400).json({ msg: "Select a hospital first" });
          }
          const user = await User.findById(req.user.id).select("name phone nationalIdNumber");
          const parts = String(user?.name || "Patient").trim().split(/\s+/);
          const firstName = parts[0] || "Patient";
          const lastName = parts.slice(1).join(" ") || "User";
          const created = await Patient.create({
            firstName,
            lastName,
            nationalId: user?.nationalIdNumber || undefined,
            contact: user?.phone || undefined,
            hospital: hospitalId,
            metadata: { userId: req.user.id },
            active: true,
          });
          patient = created._id;
        }
      }
    }

    if (!patient || !scheduledAt || !hospitalId) {
      return res
        .status(400)
        .json({ msg: "patient, hospital and scheduledAt are required" });
    }

    /**
     * 🚨 ONLY LEGAL WAY TO CREATE APPOINTMENT
     */
    const wf = await workflowService.start("CONSULTATION", {
      patient,
      doctor,
      hospital: hospitalId,
      scheduledAt,
      reason,
      createdBy: req.user.id,
    });

    const appointment = wf.context.appointment;

    /* 🔐 ABAC CONTEXT */
    req.resource = {
      ownerId: String(appointment.patient),
      hospital: appointment.hospital,
      doctor: appointment.doctor,
    };

    /* 🧾 Audit AFTER snapshot */
    res.locals.after = appointment;

    /* 🔔 Notify doctor */
    try {
      if (doctor) {
        getIO()
          .to(String(doctor))
          .emit("appointmentCreated", appointment);
      }
    } catch (_) {}

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   GET APPOINTMENT (READ ONLY — ALLOWED)
====================================================== */
export const getAppointment = async (req, res, next) => {
  try {
    const a = await Appointment.findById(req.params.id).populate(
      "patient doctor hospital"
    );

    if (!a) return res.status(404).json({ msg: "Not found" });

    /* 🔐 ABAC CONTEXT */
    req.resource = {
      ownerId: String(a.patient),
      hospital: a.hospital,
      doctor: a.doctor,
    };

    /* 🧾 Audit BEFORE snapshot */
    req.resourceSnapshot = a.toObject();

    res.json(a);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LIST APPOINTMENTS (READ ONLY)
====================================================== */
export const listAppointments = async (req, res, next) => {
  try {
    const user = req.user;
    const filter = {};
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;

    const role = normalizeRole(user.role);
    if (role === "PATIENT") {
      const requestedHospitalId = req.query.hospitalId || null;
      const ids = await resolvePatientIdsForUser(user.id, requestedHospitalId || null);
      if (!ids.length) {
        if (cursor) return res.json({ items: [], nextCursor: null, hasMore: false, limit });
        return res.json({ items: [], total: 0, page, limit });
      }
      filter.patient = { $in: ids };
      if (requestedHospitalId) filter.hospital = requestedHospitalId;
    }
    if (role === "DOCTOR") filter.doctor = user.id;
    if (role !== "PATIENT" && user.hospital) filter.hospital = user.hospital;
    if (req.query.status) filter.status = req.query.status;

    // Cursor mode: createdAt + _id descending
    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      filter.$or = [
        { createdAt: { $lt: new Date(parsed.createdAt) } },
        { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
      ];

      const rows = await Appointment.find(filter)
        .populate("patient doctor hospital")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({
            createdAt: last.createdAt,
            _id: last._id,
          })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .populate("patient doctor hospital")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Appointment.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LIST AVAILABLE DOCTORS BY HOSPITAL
====================================================== */
export const listHospitalDoctors = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestedHospitalId = req.query.hospitalId || null;
    const hospitalId =
      role === "PATIENT"
        ? requestedHospitalId
        : (requestedHospitalId || req.user.hospital || req.user.hospitalId || null);

    if (!hospitalId) {
      return res.status(400).json({ msg: "hospitalId is required" });
    }

    const rows = await User.find({
      hospital: hospitalId,
      role: "DOCTOR",
      active: true,
    })
      .select("_id name email employment.department")
      .sort({ name: 1 })
      .lean();

    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
};

/* ======================================================
   UPDATE APPOINTMENT (WORKFLOW TRANSITION)
====================================================== */
export const updateAppointment = async (req, res, next) => {
  try {
    const a = await Appointment.findById(req.params.id);
    if (!a) return res.status(404).json({ msg: "Not found" });

    /* 🔐 ABAC CONTEXT */
    req.resource = {
      ownerId: String(a.patient),
      hospital: a.hospital,
      doctor: a.doctor,
    };

    /* 🧾 Audit BEFORE */
    req.resourceSnapshot = a.toObject();

    /**
     * 🚨 NO DIRECT UPDATE
     * This is a CONSULTATION workflow transition
     */
    const wf = await workflowService.transition(
      "CONSULTATION",
      a.workflowId,
      {
        updates: req.body,
        actor: req.user,
      }
    );

    const updated = wf.context.appointment;

    /* 🧾 Audit AFTER */
    res.locals.after = updated;

    try {
      getIO()
        .to(String(updated.patient))
        .emit("appointmentUpdated", updated);
    } catch (_) {}

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   DELETE APPOINTMENT (WORKFLOW CANCEL)
====================================================== */
export const deleteAppointment = async (req, res, next) => {
  try {
    const a = await Appointment.findById(req.params.id);
    if (!a) return res.status(404).json({ msg: "Not found" });

    /* 🔐 ABAC CONTEXT */
    req.resource = {
      ownerId: String(a.patient),
      hospital: a.hospital,
      doctor: a.doctor,
    };

    /* 🧾 Audit BEFORE */
    req.resourceSnapshot = a.toObject();

    /**
     * 🚨 APPOINTMENTS ARE NEVER DELETED
     * They are CANCELLED via workflow
     */
    await workflowService.transition(
      "CONSULTATION",
      a.workflowId,
      {
        cancel: true,
        actor: req.user,
      }
    );

    /* 🧾 Audit AFTER (cancelled) */
    res.locals.after = null;

    try {
      getIO()
        .to(String(a.patient))
        .emit("appointmentCancelled", a);
    } catch (_) {}

    res.json({ msg: "Cancelled" });
  } catch (err) {
    next(err);
  }
};
