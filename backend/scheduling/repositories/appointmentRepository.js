import Appointment from "../../models/Appointment.js";

export async function findDailyAppointmentForPatient(patientId, startOfDay, endOfDay) {
  return Appointment.findOne({
    patient: patientId,
    status: { $ne: "Cancelled" },
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function findDoctorBookingAt(doctorId, scheduledAt) {
  if (!doctorId) return null;
  return Appointment.findOne({
    doctor: doctorId,
    scheduledAt,
    status: { $nin: ["Cancelled", "Completed", "NoShow"] },
  }).lean();
}

export async function countAppointmentsByDoctorOnDate(hospitalId, doctorIds, scheduledDate) {
  if (!Array.isArray(doctorIds) || doctorIds.length === 0) return new Map();

  const start = new Date(scheduledDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(scheduledDate);
  end.setHours(23, 59, 59, 999);

  const rows = await Appointment.aggregate([
    {
      $match: {
        doctor: { $in: doctorIds },
        hospital: hospitalId,
        scheduledAt: { $gte: start, $lte: end },
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

  return new Map(rows.map((row) => [String(row._id), Number(row.appointmentsToday)]));
}

export async function findAppointmentsByDoctorsInRange(hospitalId, doctorIds, start, end) {
  if (!Array.isArray(doctorIds) || doctorIds.length === 0) return [];
  return Appointment.find({
    hospital: hospitalId,
    doctor: { $in: doctorIds },
    scheduledAt: { $gte: start, $lte: end },
    status: { $nin: ["Cancelled", "Completed", "NoShow"] },
  })
    .select("doctor scheduledAt durationMins")
    .lean();
}

export async function findById(appointmentId) {
  return Appointment.findById(appointmentId).lean();
}
