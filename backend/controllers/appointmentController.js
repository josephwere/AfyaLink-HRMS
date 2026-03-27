import workflowService from "../services/workflowService.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import DoctorAvailability from "../models/DoctorAvailability.js";
import CallSession from "../models/CallSession.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { calendarOptimizeSlot } from "../utils/aiAdvanced.js";
import { resolvePatientIdsForUser } from "../services/familyMonitoringService.js";

const CLINICIAN_ROLES = ["DOCTOR", "SURGEON"];

function parseTimeToMinutes(value, fallback) {
  const match = String(value || fallback || "08:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 8 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeServiceType(input) {
  const value = String(input || "").trim();
  return value || "General Consultation";
}

function normalizeConsultationMode(input) {
  const value = String(input || "IN_PERSON").trim().toUpperCase();
  return ["IN_PERSON", "CHAT", "VOICE", "VIDEO"].includes(value) ? value : "IN_PERSON";
}

async function getConsultationSettings() {
  const settings = await getSystemSettingsDoc({ lean: true });
  return settings?.communications || {
    callsEnabled: true,
    videoCallsEnabled: true,
    voiceCallsEnabled: true,
  };
}

async function validatePreferredDoctor({ doctorId, hospitalId, scheduledDate }) {
  const doctor = await User.findOne({
    _id: doctorId,
    hospital: hospitalId,
    role: { $in: CLINICIAN_ROLES },
    active: true,
  }).select("_id name employment.department");
  if (!doctor) return null;

  const availability = await DoctorAvailability.findOne({
    doctor: doctor._id,
    hospital: hospitalId,
    dayOfWeek: scheduledDate.getDay(),
    isAvailable: true,
    consultationAvailable: true,
  }).lean();

  if (availability) {
    const mins = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
    const start = parseTimeToMinutes(availability.startTime, "08:00");
    const end = parseTimeToMinutes(availability.endTime, "17:00");
    if (mins < start || mins > end) return null;
  }

  return doctor;
}

async function autoAssignDoctor({
  hospitalId,
  scheduledDate,
  serviceType,
  preferredDoctorId = null,
}) {
  const dayStart = new Date(scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(scheduledDate);
  dayEnd.setHours(23, 59, 59, 999);

  if (preferredDoctorId) {
    const preferred = await validatePreferredDoctor({
      doctorId: preferredDoctorId,
      hospitalId,
      scheduledDate,
    });
    if (preferred) {
      return {
        doctor: preferred,
        assignmentStatus: "ASSIGNED",
        reason: "preferred_doctor",
      };
    }
  }

  const doctors = await User.find({
    hospital: hospitalId,
    role: { $in: CLINICIAN_ROLES },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
  })
    .select("_id name employment.department")
    .lean();

  if (!doctors.length) {
    return {
      doctor: null,
      assignmentStatus: "PENDING",
      reason: "no_hospital_doctors",
    };
  }

  const availabilityRows = await DoctorAvailability.find({
    hospital: hospitalId,
    dayOfWeek: scheduledDate.getDay(),
    doctor: { $in: doctors.map((doc) => doc._id) },
    isAvailable: true,
    consultationAvailable: true,
  }).lean();

  const availabilityByDoctor = new Map(
    availabilityRows.map((row) => [String(row.doctor), row])
  );

  const scheduledMinute = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  const eligibleDoctors = doctors.filter((doctor) => {
    const availability = availabilityByDoctor.get(String(doctor._id));
    if (!availability) return true;
    const start = parseTimeToMinutes(availability.startTime, "08:00");
    const end = parseTimeToMinutes(availability.endTime, "17:00");
    return scheduledMinute >= start && scheduledMinute <= end;
  });

  if (!eligibleDoctors.length) {
    return {
      doctor: null,
      assignmentStatus: "PENDING",
      reason: "no_available_schedule",
    };
  }

  const doctorIds = eligibleDoctors.map((doc) => doc._id);
  const loadRows = await Appointment.aggregate([
    {
      $match: {
        doctor: { $in: doctorIds },
        scheduledAt: { $gte: dayStart, $lte: dayEnd },
        status: { $nin: ["Cancelled", "Completed", "NoShow"] },
      },
    },
    {
      $group: {
        _id: "$doctor",
        appointmentsToday: { $sum: 1 },
      },
    },
  ]);

  const loadByDoctor = new Map(loadRows.map((row) => [String(row._id), row.appointmentsToday]));

  const ranked = eligibleDoctors
    .map((doctor) => {
      const availability = availabilityByDoctor.get(String(doctor._id));
      const slots = Number(availability?.appointmentSlots || 9999);
      const appointmentsToday = Number(loadByDoctor.get(String(doctor._id)) || 0);
      const department = String(doctor?.employment?.department || "").toLowerCase();
      const service = String(serviceType || "").toLowerCase();
      const specialtyBoost = service && department && service.includes(department) ? -1 : 0;
      return {
        doctor,
        appointmentsToday,
        slots,
        score: appointmentsToday + specialtyBoost,
      };
    })
    .filter((entry) => entry.appointmentsToday < entry.slots)
    .sort((a, b) => a.score - b.score || a.appointmentsToday - b.appointmentsToday);

  if (!ranked.length) {
    return {
      doctor: null,
      assignmentStatus: "PENDING",
      reason: "all_slots_full",
    };
  }

  return {
    doctor: ranked[0].doctor,
    assignmentStatus: preferredDoctorId ? "REASSIGNED" : "ASSIGNED",
    reason: "least_loaded_doctor",
  };
}

async function buildHospitalSlotSuggestions({
  hospitalId,
  serviceType,
  consultationMode = "IN_PERSON",
  preferredDate = new Date(),
  limit = 3,
}) {
  const baseDate = new Date(preferredDate);
  const doctorRows = await User.find({
    hospital: hospitalId,
    role: { $in: CLINICIAN_ROLES },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
  })
    .select("_id name employment.department")
    .lean();
  if (!doctorRows.length) return [];

  const suggestions = [];
  for (let offset = 0; offset < 7 && suggestions.length < limit; offset += 1) {
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + offset);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const availabilityRows = await DoctorAvailability.find({
      hospital: hospitalId,
      dayOfWeek: targetDate.getDay(),
      doctor: { $in: doctorRows.map((row) => row._id) },
      isAvailable: true,
      consultationAvailable: true,
    }).lean();

    const appointments = await Appointment.find({
      hospital: hospitalId,
      doctor: { $in: doctorRows.map((row) => row._id) },
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["Cancelled", "Completed", "NoShow"] },
    })
      .select("doctor scheduledAt durationMins")
      .lean();

    for (const doctor of doctorRows) {
      if (suggestions.length >= limit) break;
      const availability = availabilityRows.find(
        (row) => String(row.doctor) === String(doctor._id)
      );
      const doctorAppointments = appointments.filter(
        (item) => String(item.doctor) === String(doctor._id)
      );
      const workHours = {
        start: Math.floor(parseTimeToMinutes(availability?.startTime, "08:00") / 60),
        end: Math.ceil(parseTimeToMinutes(availability?.endTime, "17:00") / 60),
      };
      const slot = calendarOptimizeSlot(
        doctorAppointments,
        targetDate,
        30,
        workHours,
        []
      );
      if (!slot) continue;
      suggestions.push({
        doctorId: doctor._id,
        doctorName: doctor.name,
        specialization: doctor?.employment?.department || serviceType || "General Consultation",
        appointmentTime: slot,
        consultationMode,
      });
    }
  }

  return suggestions
    .sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime))
    .slice(0, limit);
}

async function notifyAppointmentLifecycle({ appointment, action, actorId }) {
  const notifications = [];
  if (appointment.doctor) {
    notifications.push({
      title: action === "created" ? "New Appointment Assigned" : "Appointment Reassigned",
      body:
        action === "created"
          ? "A new patient appointment was added to your queue."
          : "An appointment was assigned to your queue.",
      category: "APPOINTMENT",
      user: appointment.doctor,
      hospital: appointment.hospital,
      meta: {
        appointmentId: appointment._id,
        actorId,
      },
    });
  }
  notifications.push({
    title: appointment.doctor ? "Appointment Confirmed" : "Appointment Pending Assignment",
    body: appointment.doctor
      ? "Your appointment has been booked and a clinician has been assigned."
      : "Your appointment has been received and will be assigned by the hospital.",
    category: "APPOINTMENT",
    hospital: appointment.hospital,
    meta: {
      appointmentId: appointment._id,
      patientId: appointment.patient,
    },
  });
  await Notification.insertMany(notifications);
}

/* ======================================================
   CREATE APPOINTMENT (WORKFLOW ENTRY)
====================================================== */
export const createAppointment = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestedHospitalId = req.body?.hospitalId || null;
    const hospitalId = requestedHospitalId || req.user.hospitalId || req.user.hospital || null;
    let {
      patient,
      doctor,
      scheduledAt,
      reason,
      serviceType,
      consultationMode,
      durationMins,
    } = req.body;

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

    // Ensure doctor-created appointments remain visible in doctor queues/lists.
    if (role === "DOCTOR" && !doctor) {
      doctor = req.user.id;
    }

    if (!patient || !scheduledAt || !hospitalId) {
      return res.status(400).json({ msg: "patient, hospital and scheduledAt are required" });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ msg: "scheduledAt must be a valid date" });
    }

    serviceType = normalizeServiceType(serviceType);
    consultationMode = normalizeConsultationMode(consultationMode);

    const communications = await getConsultationSettings();
    if (!communications.callsEnabled && ["VOICE", "VIDEO"].includes(consultationMode)) {
      return res.status(403).json({ msg: "Remote consultation is currently disabled" });
    }
    if (consultationMode === "VIDEO" && !communications.videoCallsEnabled) {
      return res.status(403).json({ msg: "Video consultation is currently disabled" });
    }
    if (consultationMode === "VOICE" && !communications.voiceCallsEnabled) {
      return res.status(403).json({ msg: "Voice consultation is currently disabled" });
    }

    let assignedDoctor = doctor || null;
    let assignmentStatus = doctor ? "ASSIGNED" : "PENDING";
    if (role !== "DOCTOR") {
      const assignment = await autoAssignDoctor({
        hospitalId,
        scheduledDate,
        serviceType,
        preferredDoctorId: doctor || null,
      });
      assignedDoctor = assignment.doctor?._id || null;
      assignmentStatus = assignment.assignmentStatus;
    }

    /**
     * 🚨 ONLY LEGAL WAY TO CREATE APPOINTMENT
     */
    const wf = await workflowService.start("CONSULTATION", {
      patient,
      doctor: assignedDoctor,
      hospital: hospitalId,
      scheduledAt,
      reason,
      serviceType,
      consultationMode,
      durationMins,
      assignmentStatus,
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
      if (assignedDoctor) {
        getIO()
          .to(String(assignedDoctor))
          .emit("appointmentCreated", appointment);
      }
    } catch (_) {}

    await notifyAppointmentLifecycle({
      appointment,
      action: "created",
      actorId: req.user.id,
    });

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
      role: { $in: CLINICIAN_ROLES },
      active: true,
    })
      .select("_id name email role employment.department employment.status")
      .sort({ name: 1 })
      .lean();

    const availabilityRows = await DoctorAvailability.find({
      hospital: hospitalId,
      doctor: { $in: rows.map((row) => row._id) },
    }).lean();

    const today = new Date().getDay();
    const availabilityByDoctor = new Map(
      availabilityRows
        .filter((row) => row.dayOfWeek === today)
        .map((row) => [String(row.doctor), row])
    );

    return res.json({
      items: rows.map((row) => {
        const availability = availabilityByDoctor.get(String(row._id));
        return {
          ...row,
          specialization: row?.employment?.department || row.role,
          availableToday: availability ? availability.isAvailable !== false : true,
          consultationAvailable: availability ? availability.consultationAvailable !== false : true,
          availability,
          doctorStatus:
            row?.employment?.status === "TRANSFER_PENDING"
              ? "TRANSFER_PENDING"
              : availability?.isAvailable === false
              ? "UNAVAILABLE"
              : "ONLINE",
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
};

export const getHospitalSlotSuggestions = async (req, res, next) => {
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
    const serviceType = normalizeServiceType(req.query.serviceType || req.query.reason);
    const consultationMode = normalizeConsultationMode(req.query.consultationMode || "IN_PERSON");
    const preferredDate = req.query.preferredDate ? new Date(req.query.preferredDate) : new Date();
    const suggestions = await buildHospitalSlotSuggestions({
      hospitalId,
      serviceType,
      consultationMode,
      preferredDate,
      limit: Math.min(Math.max(Number(req.query.limit || 3), 1), 8),
    });
    return res.json({ items: suggestions });
  } catch (err) {
    return next(err);
  }
};

export const getHospitalAppointmentOps = async (req, res, next) => {
  try {
    const hospitalId = req.query.hospitalId || req.user.hospital || req.user.hospitalId;
    if (!hospitalId) return res.status(400).json({ msg: "hospitalId is required" });

    const [appointments, doctors, availabilityRows, calls] = await Promise.all([
      Appointment.find({ hospital: hospitalId })
        .populate("patient doctor")
        .sort({ scheduledAt: 1 })
        .limit(100)
        .lean(),
      User.find({
        hospital: hospitalId,
        role: { $in: CLINICIAN_ROLES },
        active: true,
      })
        .select("_id name role employment.department employment.status")
        .sort({ name: 1 })
        .lean(),
      DoctorAvailability.find({ hospital: hospitalId }).lean(),
      CallSession.find({
        hospital: hospitalId,
        deletedAt: { $exists: false },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const pendingAssignments = appointments.filter((item) => !item.doctor).length;
    const assignedToday = appointments.filter(
      (item) => item.doctor && ["Scheduled", "CheckedIn", "InConsultation"].includes(item.status)
    ).length;

    return res.json({
      summary: {
        totalAppointments: appointments.length,
        pendingAssignments,
        assignedToday,
        doctorsOnline: doctors.filter((doc) => doc.employment?.status !== "INACTIVE").length,
      },
      appointments,
      doctors,
      availability: availabilityRows,
      calls,
    });
  } catch (err) {
    return next(err);
  }
};

export const assignAppointmentDoctor = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ msg: "Appointment not found" });

    const requestedDoctorId = req.body?.doctorId || null;
    let assignedDoctor = requestedDoctorId;
    let assignmentStatus = requestedDoctorId ? "REASSIGNED" : "PENDING";

    if (!requestedDoctorId) {
      const result = await autoAssignDoctor({
        hospitalId: appointment.hospital,
        scheduledDate: new Date(appointment.scheduledAt),
        serviceType: appointment.serviceType,
      });
      assignedDoctor = result.doctor?._id || null;
      assignmentStatus = result.assignmentStatus;
    } else {
      const validDoctor = await validatePreferredDoctor({
        doctorId: requestedDoctorId,
        hospitalId: appointment.hospital,
        scheduledDate: new Date(appointment.scheduledAt),
      });
      if (!validDoctor) {
        return res.status(422).json({ msg: "Selected doctor is not available in this hospital and slot" });
      }
    }

    const wf = await workflowService.transition("CONSULTATION", appointment.workflowId, {
      updates: {
        doctor: assignedDoctor,
        assignmentStatus,
      },
      actor: req.user,
    });

    await notifyAppointmentLifecycle({
      appointment: wf.context.appointment,
      action: "reassigned",
      actorId: req.user.id,
    });

    return res.json(wf.context.appointment);
  } catch (err) {
    return next(err);
  }
};

export const getDoctorAvailability = async (req, res, next) => {
  try {
    const hospitalId = req.query.hospitalId || req.user.hospital || req.user.hospitalId;
    const doctorId = req.params.doctorId;
    const rows = await DoctorAvailability.find({
      hospital: hospitalId,
      doctor: doctorId,
    })
      .sort({ dayOfWeek: 1 })
      .lean();
    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
};

export const upsertDoctorAvailability = async (req, res, next) => {
  try {
    const hospitalId = req.body?.hospitalId || req.user.hospital || req.user.hospitalId;
    const doctorId = req.params.doctorId;
    if (!hospitalId) return res.status(400).json({ msg: "hospitalId is required" });
    const actorRole = normalizeRole(req.user.role);
    const canManageAnyDoctor = [
      "HOSPITAL_ADMIN",
      "HOSPITAL_ADMIN_ASSISTANT",
      "SYSTEM_ADMIN",
      "SUPER_ADMIN",
      "DEVELOPER",
    ].includes(actorRole);
    if (!canManageAnyDoctor && String(req.user.id) !== String(doctorId)) {
      return res.status(403).json({ msg: "You can only update your own availability" });
    }

    const doctor = await User.findOne({
      _id: doctorId,
      hospital: hospitalId,
      role: { $in: CLINICIAN_ROLES },
    }).select("_id");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found in this hospital" });

    const rows = Array.isArray(req.body?.items) ? req.body.items : [];
    const sanitized = rows
      .map((row) => ({
        doctor: doctorId,
        hospital: hospitalId,
        dayOfWeek: Number(row?.dayOfWeek),
        startTime: String(row?.startTime || "08:00"),
        endTime: String(row?.endTime || "17:00"),
        appointmentSlots: Number(row?.appointmentSlots || 12),
        isAvailable: row?.isAvailable !== false,
        consultationAvailable: row?.consultationAvailable !== false,
        modes: {
          chat: row?.modes?.chat !== false,
          voice: row?.modes?.voice === true,
          video: row?.modes?.video === true,
          inPerson: row?.modes?.inPerson !== false,
        },
        notes: String(row?.notes || ""),
        updatedBy: req.user._id,
      }))
      .filter((row) => Number.isInteger(row.dayOfWeek) && row.dayOfWeek >= 0 && row.dayOfWeek <= 6);

    await DoctorAvailability.deleteMany({ doctor: doctorId, hospital: hospitalId });
    if (sanitized.length) {
      await DoctorAvailability.insertMany(sanitized);
    }

    const saved = await DoctorAvailability.find({
      doctor: doctorId,
      hospital: hospitalId,
    })
      .sort({ dayOfWeek: 1 })
      .lean();
    return res.json({ items: saved });
  } catch (err) {
    return next(err);
  }
};

export const listCalls = async (req, res, next) => {
  try {
    const hospitalId = req.query.hospitalId || req.user.hospital || req.user.hospitalId;
    const role = normalizeRole(req.user.role);
    const filter = {
      hospital: hospitalId,
      deletedAt: { $exists: false },
    };
    if (role === "DOCTOR") filter.doctor = req.user.id;
    if (role === "PATIENT") {
      const patientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      filter.patient = { $in: patientIds };
    }
    const rows = await CallSession.find(filter)
      .populate("appointment doctor patient")
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
};

export const createCallSession = async (req, res, next) => {
  try {
    const communications = await getConsultationSettings();
    const hospitalId = req.body?.hospitalId || req.user.hospital || req.user.hospitalId;
    const { appointmentId, callType = "VOICE" } = req.body || {};
    const role = normalizeRole(req.user.role);
    if (!hospitalId || !appointmentId) {
      return res.status(400).json({ msg: "hospitalId and appointmentId are required" });
    }
    const normalizedCallType = String(callType || "VOICE").toUpperCase();
    if (!communications.callsEnabled) {
      return res.status(403).json({ msg: "Calls are disabled platform-wide" });
    }
    if (normalizedCallType === "VIDEO" && !communications.videoCallsEnabled) {
      return res.status(403).json({ msg: "Video calls are disabled platform-wide" });
    }
    if (normalizedCallType === "VOICE" && !communications.voiceCallsEnabled) {
      return res.status(403).json({ msg: "Voice calls are disabled platform-wide" });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || String(appointment.hospital) !== String(hospitalId)) {
      return res.status(404).json({ msg: "Appointment not found for this hospital" });
    }
    if (role === "PATIENT") {
      const patientIds = await resolvePatientIdsForUser(req.user.id, hospitalId || null);
      if (!patientIds.includes(String(appointment.patient))) {
        return res.status(403).json({ msg: "You can only start calls for your own appointments" });
      }
    }
    if (!appointment.doctor) {
      return res.status(422).json({ msg: "No doctor has been assigned yet" });
    }

    const item = await CallSession.create({
      patient: appointment.patient,
      doctor: appointment.doctor,
      hospital: appointment.hospital,
      appointment: appointment._id,
      callType: normalizedCallType,
      status: "REQUESTED",
      startedAt: new Date(),
    });

    await Notification.create({
      title: normalizedCallType === "VIDEO" ? "Video Consultation Requested" : "Voice Consultation Requested",
      body: "A patient started a consultation request from the appointment flow.",
      category: "CONSULTATION",
      user: appointment.doctor,
      hospital: appointment.hospital,
      meta: { appointmentId: appointment._id, callId: item._id },
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CALL_SESSION_CREATE",
      resource: "CallSession",
      resourceId: item._id,
      hospital: appointment.hospital,
      success: true,
      metadata: {
        appointmentId: appointment._id,
        callType: normalizedCallType,
      },
    });

    return res.status(201).json(item);
  } catch (err) {
    return next(err);
  }
};

export const blockCallSession = async (req, res, next) => {
  try {
    const item = await CallSession.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Call not found" });
    item.isBlocked = true;
    item.status = "TERMINATED";
    item.endedAt = new Date();
    item.blockedBy = req.user._id;
    item.blockedReason = String(req.body?.reason || "Blocked by administrator").trim();
    await item.save();
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CALL_SESSION_BLOCK",
      resource: "CallSession",
      resourceId: item._id,
      hospital: item.hospital,
      success: true,
      metadata: {
        reason: item.blockedReason,
      },
    });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

export const activateCallSession = async (req, res, next) => {
  try {
    const item = await CallSession.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Call not found" });
    const role = normalizeRole(req.user.role);
    const isPrivileged = [
      "HOSPITAL_ADMIN",
      "HOSPITAL_ADMIN_ASSISTANT",
      "SYSTEM_ADMIN",
      "SUPER_ADMIN",
      "DEVELOPER",
    ].includes(role);
    if (!isPrivileged && String(item.doctor) !== String(req.user.id)) {
      return res.status(403).json({ msg: "You can only activate your own consultation calls" });
    }
    if (item.isBlocked) {
      return res.status(422).json({ msg: "Blocked calls cannot be activated" });
    }
    item.status = "ACTIVE";
    if (!item.startedAt) item.startedAt = new Date();
    item.metadata = {
      ...(item.metadata || {}),
      activatedBy: req.user._id,
      activatedAt: new Date().toISOString(),
      roomKey: item.metadata?.roomKey || `call_${String(item._id)}`,
    };
    await item.save();
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CALL_SESSION_ACTIVATE",
      resource: "CallSession",
      resourceId: item._id,
      hospital: item.hospital,
      success: true,
      metadata: {
        appointmentId: item.appointment || null,
        callType: item.callType,
      },
    });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

export const endCallSession = async (req, res, next) => {
  try {
    const item = await CallSession.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Call not found" });
    const role = normalizeRole(req.user.role);
    const isPrivileged = [
      "HOSPITAL_ADMIN",
      "HOSPITAL_ADMIN_ASSISTANT",
      "SYSTEM_ADMIN",
      "SUPER_ADMIN",
      "DEVELOPER",
    ].includes(role);
    if (
      !isPrivileged &&
      String(item.doctor) !== String(req.user.id) &&
      String(item.blockedBy || "") !== String(req.user.id)
    ) {
      return res.status(403).json({ msg: "You can only end your own consultation calls" });
    }
    item.status = "ENDED";
    item.endedAt = new Date();
    item.metadata = {
      ...(item.metadata || {}),
      endedBy: req.user._id,
      endedAt: new Date().toISOString(),
    };
    await item.save();
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "CALL_SESSION_END",
      resource: "CallSession",
      resourceId: item._id,
      hospital: item.hospital,
      success: true,
      metadata: {
        appointmentId: item.appointment || null,
        callType: item.callType,
      },
    });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
};

export const softDeleteCallSession = async (req, res, next) => {
  try {
    const item = await CallSession.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Call not found" });
    item.deletedAt = new Date();
    if (!item.endedAt) item.endedAt = new Date();
    if (item.status === "ACTIVE" || item.status === "REQUESTED") {
      item.status = "TERMINATED";
    }
    await item.save();
    return res.json({ success: true });
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

    const updates = req.body || {};
    const hasClinicalSummary =
      Boolean(updates.notes !== undefined) ||
      Boolean(updates.status !== undefined) ||
      Boolean(updates?.metadata?.consultationSummary) ||
      Boolean(updates?.metadata?.followUpRequired !== undefined);
    if (hasClinicalSummary) {
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "APPOINTMENT_CLINICAL_UPDATE",
        resource: "Appointment",
        resourceId: updated._id,
        hospital: updated.hospital,
        success: true,
        metadata: {
          status: updated.status,
          hasNotes: Boolean(updated.notes),
          hasConsultationSummary: Boolean(updated?.metadata?.consultationSummary),
          followUpRequired: Boolean(updated?.metadata?.followUpRequired),
        },
      });
    }

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
