import workflowService from "../services/workflowService.js";
import Appointment from "../models/Appointment.js";
import { getIO } from "../utils/socket.js";

/* ======================================================
   CREATE APPOINTMENT (WORKFLOW ENTRY)
====================================================== */
export const createAppointment = async (req, res, next) => {
  try {
    const { patient, doctor, scheduledAt, reason } = req.body;

    if (!patient || !scheduledAt) {
      return res
        .status(400)
        .json({ msg: "patient and scheduledAt are required" });
    }

    /**
     * 🚨 ONLY LEGAL WAY TO CREATE APPOINTMENT
     */
    const wf = await workflowService.start("CONSULTATION", {
      patient,
      doctor,
      hospital: req.user.hospitalId,
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

    if (user.role === "Patient") filter.patient = user.id;
    if (user.role === "Doctor") filter.doctor = user.id;
    if (user.hospital) filter.hospital = user.hospital;

    const items = await Appointment.find(filter)
      .populate("patient doctor hospital")
      .limit(500);

    res.json(items);
  } catch (err) {
    next(err);
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
