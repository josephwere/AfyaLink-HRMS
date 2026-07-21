import Appointment from "../../models/Appointment.js";
import { getSystemSettingsDoc } from "../../utils/systemSettingsStore.js";

export function selectLeastLoadedDoctor(candidates = []) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: candidate.appointmentsToday + (candidate.specialtyBoost || 0),
    }))
    .sort((a, b) => a.score - b.score || a.appointmentsToday - b.appointmentsToday)
    .map((candidate) => candidate.doctor)[0] || null;
}

export function buildDoctorCandidate({ doctor, availability, appointmentsToday, serviceType, patientPreferences = {} }) {
  const specialtyBoost = serviceType && doctor?.employment?.department
    ? String(serviceType).toLowerCase().includes(String(doctor.employment.department).toLowerCase()) ? -1 : 0
    : 0;

  return {
    doctor,
    availability,
    appointmentsToday: Number(appointmentsToday || 0),
    slots: Number(availability?.appointmentSlots || 9999),
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
  timeZone,
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
      status: { $nin: ["Cancelled", "Completed", "NoShow"] },
    });
    if (existingDoctorBooking) {
      return {
        valid: false,
        code: "DOCTOR_SLOT_UNAVAILABLE",
        message: "The selected doctor is already booked for this slot.",
      };
    }
  }

  return { valid: true };
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
