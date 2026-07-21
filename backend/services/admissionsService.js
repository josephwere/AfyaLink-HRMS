import Appointment from "../models/Appointment.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getAdmissionsSummary({ hospital = {} } = {}) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const [admissionsToday, dischargesToday, pendingAdmissions] = await Promise.all([
    Appointment.countDocuments({
      ...hospital,
      scheduledAt: { $gte: todayStart, $lte: todayEnd },
      status: { $ne: "Cancelled" },
    }),
    Appointment.countDocuments({
      ...hospital,
      scheduledAt: { $gte: todayStart, $lte: todayEnd },
      status: "Completed",
    }),
    Appointment.countDocuments({
      ...hospital,
      status: { $nin: ["Cancelled", "Completed", "NoShow"] },
    }),
  ]);

  return {
    admissionsToday,
    dischargesToday,
    pendingAdmissions,
  };
}

export default getAdmissionsSummary;
