import DoctorAvailability from "../../models/DoctorAvailability.js";

export async function findAvailabilityForDoctor({ doctorId, hospitalId, dayOfWeek }) {
  return DoctorAvailability.findOne({
    doctor: doctorId,
    hospital: hospitalId,
    dayOfWeek,
    isAvailable: true,
    consultationAvailable: true,
  }).lean();
}

export async function findAvailabilityForDoctors({ hospitalId, doctorIds, dayOfWeek }) {
  if (!Array.isArray(doctorIds) || doctorIds.length === 0) return [];
  return DoctorAvailability.find({
    hospital: hospitalId,
    doctor: { $in: doctorIds },
    dayOfWeek,
    isAvailable: true,
    consultationAvailable: true,
  }).lean();
}
