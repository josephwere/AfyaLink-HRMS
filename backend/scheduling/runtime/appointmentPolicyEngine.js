import Appointment from "../../models/Appointment.js";
import Hospital from "../../models/Hospital.js";
import { getSystemSettingsDoc } from "../../utils/systemSettingsStore.js";
import { normalizeSchedulingPolicy } from "../../utils/schedulingPolicy.js";

const EXCLUDED_APPOINTMENT_STATUSES = ["Cancelled", "Completed", "NoShow", "CANCELLED", "COMPLETED", "NO_SHOW"];

export function selectLeastLoadedDoctor(candidates = []) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: candidate.appointmentsToday + (candidate.specialtyBoost || 0),
    }))
    .sort((a, b) => a.score - b.score || a.appointmentsToday - b.appointmentsToday)
    .map((candidate) => candidate.doctor)[0] || null;
}

export function buildDoctorCandidate({
  doctor,
  availability,
  appointmentsToday,
  serviceType,
  patientPreferences = {},
  policy = {},
}) {
  const specialtyBoost = serviceType && doctor?.employment?.department
    ? String(serviceType).toLowerCase().includes(String(doctor.employment.department).toLowerCase()) ? -1 : 0
    : 0;
  const policyCapacity = Number(policy?.dailyDoctorCapacity || 0);
  const availabilityCapacity = Number(availability?.appointmentSlots || 0);
  const slots = policyCapacity > 0 && availabilityCapacity > 0
    ? Math.min(policyCapacity, availabilityCapacity)
    : policyCapacity || availabilityCapacity || 9999;

  return {
    doctor,
    availability,
    appointmentsToday: Number(appointmentsToday || 0),
    slots,
    specialtyBoost,
    preferred: Boolean(patientPreferences.doctorId && String(doctor._id) === String(patientPreferences.doctorId)),
    languageMatch: Boolean(patientPreferences.language && doctor.metadata?.languages?.includes(patientPreferences.language)),
    insuranceMatch: Boolean(patientPreferences.insurance && doctor.metadata?.insurance?.includes(patientPreferences.insurance)),
  };
}

export function doctorHasCapacity(candidate) {
  return Number(candidate.appointmentsToday || 0) < Number(candidate.slots || 0);
}

export function buildAssignmentResult(doctor, preferredDoctorId, assignmentReason) {
  return {
    doctor: doctor || null,
    assignmentStatus: doctor ? (preferredDoctorId ? "REASSIGNED" : "ASSIGNED") : "PENDING",
    reason: assignmentReason,
  };
}

export async function validateAppointmentPolicy({
  patientId,
  hospitalId,
  scheduledDate,
  durationMins,
  consultationMode,
  doctorId,
}) {
  if (!patientId || !hospitalId || !scheduledDate) {
    return { valid: false, code: "INVALID_BOOKING_REQUEST", message: "Patient, hospital, and scheduled date are required." };
  }

  if (!(scheduledDate instanceof Date) || Number.isNaN(scheduledDate.getTime())) {
    return { valid: false, code: "INVALID_SCHEDULED_AT", message: "scheduledAt must be a valid date." };
  }

  if (!Number.isInteger(durationMins) || durationMins < 5 || durationMins > 480) {
    return { valid: false, code: "INVALID_DURATION", message: "Appointment duration must be between 5 and 480 minutes." };
  }

  const hospital = await Hospital.findById(hospitalId).select("schedulingPolicy active").lean();
  if (!hospital || hospital.active === false) {
    return { valid: false, code: "HOSPITAL_UNAVAILABLE", message: "This hospital is not available for appointment booking." };
  }

  const policy = normalizeSchedulingPolicy(hospital.schedulingPolicy || {});
  const now = new Date();
  const horizonEndsAt = new Date(now.getTime() + policy.bookingHorizonDays * 24 * 60 * 60 * 1000);
  if (scheduledDate > horizonEndsAt) {
    return {
      valid: false,
      code: "BOOKING_HORIZON_EXCEEDED",
      message: `This hospital accepts appointments up to ${policy.bookingHorizonDays} days ahead. Please choose an earlier date.`,
      statusCode: 409,
      policy,
    };
  }

  const day = scheduledDate.getDay();
  if (!policy.weekendBookingEnabled && (day === 0 || day === 6)) {
    return {
      valid: false,
      code: "WEEKEND_BOOKING_DISABLED",
      message: "Weekend appointments are not available at this hospital. Please choose a weekday.",
      statusCode: 409,
      policy,
    };
  }

  const settings = await getSystemSettingsDoc({ lean: true });
  const communications = settings?.communications || {
    callsEnabled: true,
    videoCallsEnabled: true,
    voiceCallsEnabled: true,
  };

  if (["VOICE", "VIDEO"].includes(consultationMode)) {
    if (!communications.callsEnabled) {
      return { valid: false, code: "REMOTE_CONSULTATION_DISABLED", message: "Remote consultation is currently disabled." };
    }
    if (consultationMode === "VIDEO" && !communications.videoCallsEnabled) {
      return { valid: false, code: "VIDEO_CONSULTATION_DISABLED", message: "Video consultation is currently disabled." };
    }
    if (consultationMode === "VOICE" && !communications.voiceCallsEnabled) {
      return { valid: false, code: "VOICE_CONSULTATION_DISABLED", message: "Voice consultation is currently disabled." };
    }
  }

  if (doctorId && typeof doctorId === "string" && doctorId.trim()) {
    const existingDoctorBooking = await Appointment.findOne({
      doctor: doctorId,
      scheduledAt: scheduledDate,
      status: { $nin: EXCLUDED_APPOINTMENT_STATUSES },
    });
    if (existingDoctorBooking) {
      return {
        valid: false,
        code: "DOCTOR_SLOT_UNAVAILABLE",
        message: "The selected doctor is already booked for this slot.",
      };
    }
  }

  return { valid: true, policy };
}

export function allowTelemedicineMode(availability, consultationMode) {
  if (!availability) return true;
  switch (consultationMode) {
    case "CHAT":
      return availability.modes?.chat !== false;
    case "VOICE":
      return availability.modes?.voice === true;
    case "VIDEO":
      return availability.modes?.video === true;
    default:
      return availability.modes?.inPerson !== false;
  }
}
