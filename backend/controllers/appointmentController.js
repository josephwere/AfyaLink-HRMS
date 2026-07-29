import workflowService from "../services/workflowService.js";
import schedulingService from "../services/schedulingService.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Notification from "../models/Notification.js";
import { notify, notifyRolesInHospital } from "../services/notificationService.js";
import AuditLog from "../models/AuditLog.js";
import DoctorAvailability from "../models/DoctorAvailability.js";
import CallSession from "../models/CallSession.js";
import mongoose from "mongoose";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { calendarOptimizeSlot } from "../utils/aiAdvanced.js";
import { resolvePatientIdsForUser } from "../services/familyMonitoringService.js";
import { serializeAppointment } from "../utils/serializers.js";
import { buildBusinessIdSearchFilter } from "../utils/businessIdSearch.js";
import { normalizeSchedulingPolicy } from "../utils/schedulingPolicy.js";

const CLINICIAN_ROLES = ["DOCTOR", "SURGEON"];
const DEFAULT_BOOKING_TIME_ZONE = process.env.DEFAULT_TIME_ZONE || "Africa/Nairobi";
const DOCTOR_WORK_STATUSES = new Set(["AVAILABLE", "BUSY_MANUAL", "BUSY_AUTOMATIC", "OFFLINE"]);
const ASSIGNABLE_DOCTOR_WORK_STATUSES = new Set(["AVAILABLE"]);
const APPOINTMENT_INACTIVE_STATUSES = ["Cancelled", "Completed", "NoShow", "CANCELLED", "COMPLETED", "NO_SHOW"];
const DEMO_HOSPITAL_FALLBACK_IDS = [
  process.env.DEMO_HOSPITAL_ID,
  process.env.E2E_HOSPITAL_ID,
  process.env.HOSPITAL_ID,
]
  .filter(Boolean)
  .map((value) => String(value).trim())
  .filter(Boolean);

function normalizeDoctorWorkStatus(value) {
  const normalized = String(value || "AVAILABLE").trim().toUpperCase();
  if (normalized === "BUSY") return "BUSY_MANUAL";
  if (normalized === "ONLINE") return "AVAILABLE";
  if (DOCTOR_WORK_STATUSES.has(normalized)) return normalized;
  return "AVAILABLE";
}

function getDoctorWorkStatus(user = {}) {
  if (user?.active === false || user?.employment?.status === "INACTIVE") return "OFFLINE";
  return normalizeDoctorWorkStatus(user?.metadata?.doctorWorkStatus || "AVAILABLE");
}

function serializeDoctorWorkStatus(user = {}) {
  const status = getDoctorWorkStatus(user);
  return {
    status,
    label:
      status === "AVAILABLE"
        ? "Available"
        : status === "BUSY_AUTOMATIC"
        ? "Busy (Automatic)"
        : status === "BUSY_MANUAL"
        ? "Busy"
        : "Offline",
    source: user?.metadata?.doctorWorkStatusSource || (status === "AVAILABLE" ? "DEFAULT" : "SYSTEM"),
    eligibleForAssignment: ASSIGNABLE_DOCTOR_WORK_STATUSES.has(status),
    updatedAt: user?.metadata?.doctorWorkStatusUpdatedAt || null,
  };
}

function doctorWorkStatusQuery() {
  return {
    $or: [
      { "metadata.doctorWorkStatus": { $exists: false } },
      { "metadata.doctorWorkStatus": { $in: ["", "AVAILABLE", "ONLINE"] } },
    ],
  };
}

async function resolveDemoHospitalFallbackId() {
  if (DEMO_HOSPITAL_FALLBACK_IDS.length) {
    return DEMO_HOSPITAL_FALLBACK_IDS[0];
  }

  const fallbackHospital = await Hospital.findOne({ active: true }).sort({ createdAt: 1 }).select("_id").lean();
  return fallbackHospital?._id ? String(fallbackHospital._id) : null;
}

async function enforcePatientCancellationPolicy({ appointment, role }) {
  if (normalizeRole(role) !== "PATIENT") return null;

  const scheduledAt = appointment?.scheduledAt ? new Date(appointment.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return null;

  const hospital = appointment?.hospital
    ? await Hospital.findById(appointment.hospital).select("schedulingPolicy").lean()
    : null;
  const policy = normalizeSchedulingPolicy(hospital?.schedulingPolicy || {});
  const cutoffMs = policy.cancellationCutoffHours * 60 * 60 * 1000;
  if (cutoffMs <= 0) return null;

  const msUntilAppointment = scheduledAt.getTime() - Date.now();
  if (msUntilAppointment < cutoffMs) {
    return {
      status: 409,
      body: {
        msg: "This appointment is inside the hospital cancellation window. Please contact the hospital if you need urgent help changing it.",
        code: "CANCELLATION_CUTOFF_ACTIVE",
        cancellationCutoffHours: policy.cancellationCutoffHours,
        scheduledAt: scheduledAt.toISOString(),
      },
    };
  }

  return null;
}

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

function normalizeTimeZone(value) {
  const candidate = String(value || DEFAULT_BOOKING_TIME_ZONE).trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_BOOKING_TIME_ZONE;
  }
}

function getTimeZoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour === "24" ? "0" : values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return localAsUtc - date.getTime();
}

function zonedDateTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstResult = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstResult), timeZone);
  return new Date(utcGuess - secondOffset);
}

export function normalizeScheduledAtInput(value, timeZoneInput = DEFAULT_BOOKING_TIME_ZONE) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value !== "string") {
    return new Date(NaN);
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return new Date(NaN);
  }

  const isoLike = new Date(trimmed);
  if (!Number.isNaN(isoLike.getTime()) && /[Zz]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return isoLike;
  }

  const datetimeLocalMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (datetimeLocalMatch) {
    const [, year, month, day, hour, minute, second = "0", millisecond = "0"] = datetimeLocalMatch;
    const normalizedTimeZone = normalizeTimeZone(timeZoneInput);
    return zonedDateTimeToUtc(
      {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second),
        millisecond: Number(millisecond.padEnd(3, "0")),
      },
      normalizedTimeZone
    );
  }

  return isoLike;
}

function getPatientBookingDayBounds(timeZoneInput) {
  const timeZone = normalizeTimeZone(timeZoneInput);
  const now = new Date();
  const today = getTimeZoneParts(now, timeZone);
  const tomorrowUtc = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const tomorrow = {
    year: tomorrowUtc.getUTCFullYear(),
    month: tomorrowUtc.getUTCMonth() + 1,
    day: tomorrowUtc.getUTCDate(),
  };
  const startOfToday = zonedDateTimeToUtc({ year: today.year, month: today.month, day: today.day }, timeZone);
  const startOfTomorrow = zonedDateTimeToUtc(tomorrow, timeZone);
  return { startOfToday, startOfTomorrow, timeZone };
}

async function enforcePatientDailyBookingLimit({ role, patientId, timeZone, res }) {
  if (role !== "PATIENT" || !patientId) return false;
  const { startOfToday, startOfTomorrow, timeZone: normalizedTimeZone } = getPatientBookingDayBounds(timeZone);

  const existingAppointment = await Appointment.findOne({
    patient: patientId,
    status: { $ne: "Cancelled" },
    createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
  })
    .sort({ createdAt: -1 })
    .select("_id createdAt scheduledAt status serviceType consultationMode doctor reason")
    .populate("doctor", "name")
    .lean();

  if (!existingAppointment) return false;

  res.status(409).json({
    msg: "You're already scheduled for today.",
    code: "APPOINTMENT_DAILY_LIMIT",
    nextAvailableAt: startOfTomorrow,
    timeZone: normalizedTimeZone,
    existingAppointment: {
      _id: existingAppointment._id,
      createdAt: existingAppointment.createdAt,
      scheduledAt: existingAppointment.scheduledAt,
      status: existingAppointment.status,
      serviceType: existingAppointment.serviceType,
      consultationMode: existingAppointment.consultationMode,
      reason: existingAppointment.reason,
      doctor: existingAppointment.doctor || null,
    },
    guidance: {
      title: "You're Already Scheduled",
      message: "Good news! You already have an appointment booked for today. You can make another appointment tomorrow after midnight.",
      emergencyMessage: "If this is an emergency, please contact a healthcare provider immediately.",
    },
  });
  return true;
}

async function getConsultationSettings() {
  const settings = await getSystemSettingsDoc({ lean: true });
  return settings?.communications || {
    callsEnabled: true,
    videoCallsEnabled: true,
    voiceCallsEnabled: true,
  };
}

async function getPatientUserId(patientId) {
  if (!patientId) return "";
  const patient = await Patient.findById(patientId).select("metadata.userId").lean();
  return patient?.metadata?.userId ? String(patient.metadata.userId) : "";
}

async function emitConsultationLifecycle(eventName, callSession, extra = {}) {
  try {
    const patientUserId = await getPatientUserId(callSession.patient);
    const payload = {
      callId: String(callSession._id),
      patientId: callSession.patient ? String(callSession.patient) : null,
      doctorId: callSession.doctor ? String(callSession.doctor) : null,
      hospitalId: callSession.hospital ? String(callSession.hospital) : null,
      appointmentId: callSession.appointment ? String(callSession.appointment) : null,
      callType: callSession.callType,
      status: callSession.status,
      event: eventName,
      emittedAt: new Date().toISOString(),
      ...extra,
    };
    const io = getIO();
    if (patientUserId) io.to(patientUserId).emit(eventName, payload);
    if (callSession.doctor) io.to(String(callSession.doctor)).emit(eventName, payload);
    if (callSession.hospital) io.to(String(callSession.hospital)).emit(eventName, payload);
  } catch (_) {
    // Realtime delivery is best-effort; API success must not depend on sockets.
  }
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
    ...doctorWorkStatusQuery(),
  })
    .select("_id name employment.department metadata.doctorWorkStatus")
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
    ...doctorWorkStatusQuery(),
  })
    .select("_id name employment.department metadata.doctorWorkStatus")
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
  const patientUserId = await getPatientUserId(appointment.patient);

  // Notify assigned doctor directly
  if (appointment.doctor) {
    await notify({
      user: appointment.doctor,
      hospital: appointment.hospital,
      title: action === "created" ? "New Appointment Assigned" : "Appointment Reassigned",
      body:
        action === "created"
          ? "A new patient appointment was added to your queue."
          : "An appointment was assigned to your queue.",
      category: "APPOINTMENT",
      meta: { appointmentId: appointment._id, actorId },
    });
  }

  // Notify patient
  if (patientUserId) {
    await notify({
      user: patientUserId,
      hospital: appointment.hospital,
      title: appointment.doctor ? "Appointment Confirmed" : "Appointment Pending Assignment",
      body: appointment.doctor
        ? "Your appointment has been booked and a clinician has been assigned."
        : "Your appointment has been received and will be assigned by the hospital.",
      category: "APPOINTMENT",
      meta: { appointmentId: appointment._id, patientId: appointment.patient },
    });
  }

  if (!appointment.doctor) {
    await notifyRolesInHospital({
      hospital: appointment.hospital,
      roles: ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"],
      title: "Appointment needs clinician assignment",
      body: "A patient selected a service and time, but no matching doctor was available. Review the appointment queue.",
      category: "OPERATIONAL",
      meta: { appointmentId: appointment._id, actorId, assignmentStatus: appointment.assignmentStatus || "PENDING" },
    });
  }

  // Notify receptionists on new bookings so front desk staff can prepare
  if (action === "created") {
    try {
      const patientLabel = appointment.patient && typeof appointment.patient === "object"
        ? `${appointment.patient.firstName || ""} ${appointment.patient.lastName || ""}`.trim()
        : "A patient";
      const title = "Appointment Booked";
      const body = `${patientLabel} booked an appointment.`;
      await notifyRolesInHospital({ hospital: appointment.hospital, roles: ["RECEPTIONIST"], title, body, category: "OPERATIONAL", meta: { appointmentId: appointment._id } });
    } catch (err) {
      console.error("Failed to notify receptionists about new booking:", err);
    }
  }
}

/* ======================================================
   CREATE APPOINTMENT (WORKFLOW ENTRY)
====================================================== */
export const createAppointment = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    const requestedHospitalId = req.body?.hospitalId || null;
    let hospitalId = requestedHospitalId || req.user.hospitalId || req.user.hospital || null;
    if (!hospitalId && role !== "PATIENT") {
      hospitalId = await resolveDemoHospitalFallbackId();
    }
    if (!hospitalId && role === "PATIENT") {
      hospitalId = await resolveDemoHospitalFallbackId();
    }
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

    // Patients book a hospital service/time; the scheduling engine owns clinician allocation.
    if (role === "PATIENT") {
      doctor = null;
    }

    // Ensure doctor-created appointments remain visible in doctor queues/lists.
    if (role === "DOCTOR" && !doctor) {
      doctor = req.user.id;
    }

    if (!patient || !scheduledAt || !hospitalId) {
      return res.status(400).json({ msg: "patient, hospital and scheduledAt are required" });
    }

    const scheduledDate = normalizeScheduledAtInput(
      scheduledAt,
      req.body?.timeZone || req.headers["x-time-zone"]
    );
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ msg: "scheduledAt must be a valid date" });
    }

    const patientDailyLimitBlocked = await enforcePatientDailyBookingLimit({
      role,
      patientId: patient,
      timeZone: req.body?.timeZone || req.headers["x-time-zone"],
      res,
    });
    if (patientDailyLimitBlocked) return;

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

    // Delegate booking authority and doctor assignment to scheduling runtime.
    const assignedDoctor = doctor || null;
    const assignmentStatus = doctor ? "ASSIGNED" : "PENDING";

    const appointment = await schedulingService.bookAppointment({
      patient,
      doctor: assignedDoctor,
      hospitalId,
      scheduledAt: scheduledDate,
      reason,
      serviceType,
      consultationMode,
      durationMins,
      assignmentStatus,
      createdBy: req.user.id,
    });

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
      const patientUserId = await getPatientUserId(appointment.patient);
      if (patientUserId) {
        getIO()
          .to(patientUserId)
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
    const id = String(req.params.id || "").trim();
    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { appointmentId: id }] }
      : { appointmentId: id };

    const a = await Appointment.findOne(query).populate(
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

    res.json(serializeAppointment(a));
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
    const q = (req.query.q || "").trim();

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
    if (q) {
      filter.$or = buildBusinessIdSearchFilter(q, ["appointmentId"], [
        { status: { $regex: q, $options: "i" } },
        { serviceType: { $regex: q, $options: "i" } },
      ]).$or;
    }

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

      const cursorFilter = {
        ...filter,
        $or: [
          { createdAt: { $lt: new Date(parsed.createdAt) } },
          { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
        ],
      };
      const rows = await Appointment.find(cursorFilter)
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
      return res.json({ items: items.map(serializeAppointment), nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .populate("patient doctor hospital")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Appointment.countDocuments(filter),
    ]);

    res.json({ items: items.map(serializeAppointment), total, page, limit });
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
      .select("_id name email role employment.department employment.status metadata.doctorWorkStatus metadata.doctorWorkStatusSource metadata.doctorWorkStatusUpdatedAt")
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
        const workStatus = serializeDoctorWorkStatus(row);
        return {
          ...row,
          specialization: row?.employment?.department || row.role,
          availableToday: workStatus.eligibleForAssignment && (availability ? availability.isAvailable !== false : true),
          consultationAvailable: availability ? availability.consultationAvailable !== false : true,
          availability,
          doctorStatus:
            row?.employment?.status === "TRANSFER_PENDING"
              ? "TRANSFER_PENDING"
              : availability?.isAvailable === false
              ? "UNAVAILABLE"
              : workStatus.status,
          workStatus,
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
    const suggestions = await schedulingService.suggestHospitalSlots({
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
        .select("_id name role employment.department employment.status metadata.doctorWorkStatus metadata.doctorWorkStatusSource metadata.doctorWorkStatusUpdatedAt")
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

    const doctorStatusRows = doctors.map((doctor) => serializeDoctorWorkStatus(doctor));
    const availableDoctors = doctorStatusRows.filter((status) => status.status === "AVAILABLE").length;
    const busyDoctors = doctorStatusRows.filter((status) => status.status === "BUSY_MANUAL" || status.status === "BUSY_AUTOMATIC").length;
    const offlineDoctors = doctorStatusRows.filter((status) => status.status === "OFFLINE").length;
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
        availableDoctors,
        busyDoctors,
        offlineDoctors,
        capacityOverflow: Math.max(0, pendingAssignments - availableDoctors),
      },
      appointments,
      doctors: doctors.map((doctor) => ({ ...doctor, workStatus: serializeDoctorWorkStatus(doctor) })),
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
      const result = await schedulingService.assignDoctor({
        hospitalId: appointment.hospital,
        scheduledDate: new Date(appointment.scheduledAt),
        serviceType: appointment.serviceType,
        consultationMode: appointment.consultationMode,
        preferredDoctorId: null,
      });
      assignedDoctor = result.doctor?._id || result.doctor || null;
      assignmentStatus = result.assignmentStatus;
    } else {
      const validDoctor = await schedulingService.validatePreferredDoctor({
        doctorId: requestedDoctorId,
        hospitalId: appointment.hospital,
        scheduledDate: new Date(appointment.scheduledAt),
        consultationMode: appointment.consultationMode,
      });
      if (!validDoctor) {
        return res.status(422).json({ msg: "Selected doctor is not available in this hospital and slot" });
      }
      assignedDoctor = validDoctor._id;
      assignmentStatus = "REASSIGNED";
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

async function assignQueuedAppointmentsToDoctor({ doctor, actorId, limit = 5 }) {
  const hospitalId = doctor?.hospital;
  if (!hospitalId || getDoctorWorkStatus(doctor) !== "AVAILABLE") {
    return [];
  }

  const queued = await Appointment.find({
    hospital: hospitalId,
    assignmentStatus: "PENDING",
    status: { $nin: APPOINTMENT_INACTIVE_STATUSES },
    $or: [{ doctor: null }, { doctor: { $exists: false } }],
  })
    .sort({ scheduledAt: 1, createdAt: 1 })
    .limit(25);

  const assigned = [];
  for (const appointment of queued) {
    if (assigned.length >= limit) break;
    if (!appointment.workflowId) continue;
    const validDoctor = await schedulingService.validatePreferredDoctor({
      doctorId: doctor._id,
      hospitalId: appointment.hospital,
      scheduledDate: new Date(appointment.scheduledAt),
      consultationMode: appointment.consultationMode,
    });
    if (!validDoctor) continue;

    const assignedAt = new Date();
    const wf = await workflowService.transition("CONSULTATION", appointment.workflowId, {
      updates: {
        doctor: doctor._id,
        assignmentStatus: "ASSIGNED",
        confirmedAt: appointment.confirmedAt || assignedAt,
        confirmedBy: actorId,
        metadata: {
          ...(appointment.metadata || {}),
          autoAssignedFromQueue: true,
          autoAssignedAt: assignedAt.toISOString(),
          autoAssignedReason: "doctor_marked_available",
        },
      },
      actor: { _id: actorId, id: actorId, role: "SYSTEM" },
    });

    await notifyAppointmentLifecycle({
      appointment: wf.context.appointment,
      action: "reassigned",
      actorId,
    });
    assigned.push(wf.context.appointment);
  }

  return assigned;
}

async function findQueuedAppointmentForReleasedSlot(appointment) {
  if (!appointment?.hospital) return null;
  const baseQuery = {
    hospital: appointment.hospital,
    assignmentStatus: "PENDING",
    status: { $nin: APPOINTMENT_INACTIVE_STATUSES },
    _id: { $ne: appointment._id },
    $or: [{ doctor: null }, { doctor: { $exists: false } }],
  };
  const serviceQuery = appointment.serviceType
    ? { ...baseQuery, serviceType: appointment.serviceType }
    : baseQuery;

  return (
    (await Appointment.findOne(serviceQuery).sort({ scheduledAt: 1, createdAt: 1 })) ||
    (await Appointment.findOne(baseQuery).sort({ scheduledAt: 1, createdAt: 1 }))
  );
}

async function assignNextQueuedAppointmentToReleasedSlot({ cancelledAppointment, actorId }) {
  const appointment = cancelledAppointment?.toObject
    ? cancelledAppointment.toObject()
    : cancelledAppointment;
  if (!appointment?.doctor || !appointment?.hospital || !appointment?.scheduledAt) return null;

  const releasedSlot = new Date(appointment.scheduledAt);
  if (Number.isNaN(releasedSlot.getTime()) || releasedSlot.getTime() <= Date.now()) return null;

  const doctor = await User.findOne({
    _id: appointment.doctor,
    hospital: appointment.hospital,
    role: { $in: CLINICIAN_ROLES },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
  }).select("_id role hospital active employment.status metadata");
  if (!doctor || getDoctorWorkStatus(doctor) !== "AVAILABLE") return null;

  const queuedAppointment = await findQueuedAppointmentForReleasedSlot(appointment);
  if (!queuedAppointment?.workflowId) return null;

  const validDoctor = await schedulingService.validatePreferredDoctor({
    doctorId: doctor._id,
    hospitalId: appointment.hospital,
    scheduledDate: releasedSlot,
    consultationMode: queuedAppointment.consultationMode || appointment.consultationMode,
  });
  if (!validDoctor) return null;

  const now = new Date();
  const wf = await workflowService.transition("CONSULTATION", queuedAppointment.workflowId, {
    updates: {
      doctor: doctor._id,
      scheduledAt: releasedSlot,
      assignmentStatus: "ASSIGNED",
      confirmedAt: queuedAppointment.confirmedAt || now,
      confirmedBy: actorId,
      rescheduledAt: now,
      rescheduledBy: actorId,
      rescheduledFrom: queuedAppointment.scheduledAt,
      metadata: {
        ...(queuedAppointment.metadata || {}),
        autoAssignedFromCancellation: true,
        releasedAppointmentId: String(appointment._id),
        previousScheduledAt: queuedAppointment.scheduledAt
          ? new Date(queuedAppointment.scheduledAt).toISOString()
          : null,
        autoAssignedAt: now.toISOString(),
      },
    },
    actor: { _id: actorId, id: actorId, role: "SYSTEM" },
  });

  await notifyAppointmentLifecycle({
    appointment: wf.context.appointment,
    action: "reassigned",
    actorId,
  });

  return wf.context.appointment;
}

async function setDoctorAutomaticStatus({ doctorId, status, source = "SYSTEM", onlyIfAutomatic = false }) {
  if (!doctorId) return null;
  const doctor = await User.findById(doctorId).select("_id role active employment.status metadata");
  if (!doctor || !CLINICIAN_ROLES.includes(normalizeRole(doctor.role))) return null;
  const currentStatus = getDoctorWorkStatus(doctor);
  if (onlyIfAutomatic && currentStatus !== "BUSY_AUTOMATIC") return serializeDoctorWorkStatus(doctor);
  if (currentStatus === "BUSY_MANUAL" && status === "BUSY_AUTOMATIC") return serializeDoctorWorkStatus(doctor);
  if (currentStatus === "OFFLINE" && status !== "AVAILABLE") return serializeDoctorWorkStatus(doctor);

  doctor.metadata = {
    ...(doctor.metadata || {}),
    doctorWorkStatus: normalizeDoctorWorkStatus(status),
    doctorWorkStatusSource: source,
    doctorWorkStatusUpdatedAt: new Date().toISOString(),
    doctorWorkStatusUpdatedBy: "SYSTEM",
  };
  await doctor.save();
  return serializeDoctorWorkStatus(doctor);
}

export const getMyDoctorWorkStatus = async (req, res, next) => {
  try {
    const doctor = await User.findById(req.user.id || req.user._id)
      .select("_id role active employment.status metadata")
      .lean();
    if (!doctor || !CLINICIAN_ROLES.includes(normalizeRole(doctor.role))) {
      return res.status(403).json({ msg: "Only clinicians can manage doctor availability status" });
    }
    return res.json(serializeDoctorWorkStatus(doctor));
  } catch (err) {
    return next(err);
  }
};

export const updateMyDoctorWorkStatus = async (req, res, next) => {
  try {
    const actorId = req.user._id || req.user.id;
    const nextStatus = normalizeDoctorWorkStatus(req.body?.status);
    if (!["AVAILABLE", "BUSY_MANUAL", "OFFLINE"].includes(nextStatus)) {
      return res.status(400).json({ msg: "Status must be Available, Busy, or Offline" });
    }

    const doctor = await User.findById(actorId).select("_id role hospital active employment.status metadata");
    if (!doctor || !CLINICIAN_ROLES.includes(normalizeRole(doctor.role))) {
      return res.status(403).json({ msg: "Only clinicians can manage doctor availability status" });
    }

    doctor.metadata = {
      ...(doctor.metadata || {}),
      doctorWorkStatus: nextStatus,
      doctorWorkStatusSource: "MANUAL",
      doctorWorkStatusUpdatedAt: new Date().toISOString(),
      doctorWorkStatusUpdatedBy: String(actorId),
    };
    await doctor.save();

    let assignedFromQueue = [];
    if (nextStatus === "AVAILABLE") {
      assignedFromQueue = await assignQueuedAppointmentsToDoctor({ doctor, actorId, limit: 5 });
    }

    try {
      getIO().to(String(actorId)).emit("doctorWorkStatusUpdated", {
        ...serializeDoctorWorkStatus(doctor),
        assignedFromQueue: assignedFromQueue.length,
      });
    } catch (_) {}

    return res.json({
      ...serializeDoctorWorkStatus(doctor),
      assignedFromQueue: assignedFromQueue.length,
      assignedAppointments: assignedFromQueue.map((appointment) => serializeAppointment(appointment)),
    });
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

    await notify({
      user: appointment.doctor,
      hospital: appointment.hospital,
      title: normalizedCallType === "VIDEO" ? "Video Consultation Requested" : "Voice Consultation Requested",
      body: "A patient started a consultation request from the appointment flow.",
      category: "CONSULTATION",
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

    await emitConsultationLifecycle("consultation_requested", item, {
      requestedBy: req.user._id ? String(req.user._id) : String(req.user.id || ""),
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
    await setDoctorAutomaticStatus({ doctorId: item.doctor, status: "BUSY_AUTOMATIC" });
    const patientUserId = await getPatientUserId(item.patient);
    if (patientUserId) {
      await notify({
        user: patientUserId,
        hospital: item.hospital,
        title: "Doctor accepted consultation",
        body: "Your doctor is ready. Join your secure consultation room.",
        category: "CONSULTATION",
        meta: { appointmentId: item.appointment, callId: item._id, callType: item.callType },
      });
    }
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
    await emitConsultationLifecycle("consultation_accepted", item, {
      acceptedBy: req.user._id ? String(req.user._id) : String(req.user.id || ""),
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
    const previousStatus = item.status;
    item.status = "ENDED";
    item.endedAt = new Date();
    item.metadata = {
      ...(item.metadata || {}),
      endedBy: req.user._id,
      endedAt: new Date().toISOString(),
    };
    await item.save();
    await setDoctorAutomaticStatus({ doctorId: item.doctor, status: "AVAILABLE", onlyIfAutomatic: true });
    const patientUserId = await getPatientUserId(item.patient);
    if (patientUserId) {
      await notify({
        user: patientUserId,
        hospital: item.hospital,
        title: previousStatus === "REQUESTED" ? "Consultation request declined" : "Consultation completed",
        body:
          previousStatus === "REQUESTED"
            ? "The doctor could not join this consultation. You can request another online consultation from your appointment."
            : "Your consultation has ended. Summary, prescription, or follow-up details will appear when available.",
        category: "CONSULTATION",
        meta: { appointmentId: item.appointment, callId: item._id, callType: item.callType },
      });
    }
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
    await emitConsultationLifecycle(
      previousStatus === "REQUESTED" ? "consultation_declined" : "consultation_completed",
      item,
      {
        endedBy: req.user._id ? String(req.user._id) : String(req.user.id || ""),
        previousStatus,
      }
    );
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

    const nextStatus = String(updated?.status || "").toUpperCase();
    if (["INCONSULTATION", "IN_CONSULTATION", "IN_ENCOUNTER", "READY_FOR_PROVIDER"].includes(nextStatus)) {
      await setDoctorAutomaticStatus({ doctorId: updated.doctor, status: "BUSY_AUTOMATIC" });
    }
    if (["COMPLETED", "CANCELLED", "NO_SHOW", "NOSHOW"].includes(nextStatus)) {
      await setDoctorAutomaticStatus({ doctorId: updated.doctor, status: "AVAILABLE", onlyIfAutomatic: true });
    }

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
      const patientUserId = await getPatientUserId(updated.patient);
      if (patientUserId) {
        getIO()
          .to(patientUserId)
          .emit("appointmentUpdated", updated);
      }
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
    const role = normalizeRole(req.user.role);

    if (role === "PATIENT") {
      const ownPatientIds = await resolvePatientIdsForUser(req.user.id, a.hospital || null);
      if (!ownPatientIds.includes(String(a.patient))) {
        return res.status(403).json({
          msg: "You can only cancel appointments linked to your patient profile",
          code: "APPOINTMENT_ACCESS_DENIED",
        });
      }
    }

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
    const cancellationPolicyBlock = await enforcePatientCancellationPolicy({
      appointment: a,
      role,
    });
    if (cancellationPolicyBlock) {
      return res
        .status(cancellationPolicyBlock.status)
        .json(cancellationPolicyBlock.body);
    }

    const cancelledAt = new Date();
    const wf = await workflowService.transition(
      "CONSULTATION",
      a.workflowId,
      {
        cancel: true,
        updates: {
          cancelledAt,
          cancelledBy: req.user._id || req.user.id,
          cancellationReason: String(req.body?.reason || "Cancelled by user").trim(),
          metadata: {
            ...(a.metadata || {}),
            cancelledByRole: req.user.role,
            cancelledAt: cancelledAt.toISOString(),
          },
        },
        actor: req.user,
      }
    );
    const cancelledAppointment = wf.context.appointment;
    const reassignedAppointment = await assignNextQueuedAppointmentToReleasedSlot({
      cancelledAppointment,
      actorId: req.user._id || req.user.id,
    });

    await setDoctorAutomaticStatus({
      doctorId: cancelledAppointment.doctor,
      status: "AVAILABLE",
      onlyIfAutomatic: true,
    });

    /* 🧾 Audit AFTER (cancelled) */
    res.locals.after = cancelledAppointment;

    try {
      const patientUserId = await getPatientUserId(cancelledAppointment.patient);
      getIO()
        .to(patientUserId || String(cancelledAppointment.patient))
        .emit("appointmentCancelled", serializeAppointment(cancelledAppointment));
      if (reassignedAppointment) {
        const reassignedPatientUserId = await getPatientUserId(reassignedAppointment.patient);
        if (reassignedPatientUserId) {
          getIO()
            .to(reassignedPatientUserId)
            .emit("appointmentReassignedFromQueue", serializeAppointment(reassignedAppointment));
        }
      }
    } catch (_) {}

    res.json({
      msg: reassignedAppointment
        ? "Cancelled and released slot assigned to the next waiting patient"
        : "Cancelled",
      cancelledAppointment: serializeAppointment(cancelledAppointment),
      reassignedAppointment: reassignedAppointment
        ? serializeAppointment(reassignedAppointment)
        : null,
    });
  } catch (err) {
    next(err);
  }
};
