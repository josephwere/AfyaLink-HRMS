import Appointment from "../models/Appointment.js";
import LabOrder from "../models/LabOrder.js";

export async function getRadiologySummary({ hospital = {} } = {}) {
  const [pendingImagingStudies, completedImagingStudies, criticalFindingsBacklog] = await Promise.all([
    LabOrder.countDocuments({
      ...hospital,
      status: "Pending",
    }),
    LabOrder.countDocuments({
      ...hospital,
      status: "Completed",
    }),
    Appointment.countDocuments({
      ...hospital,
      reason: { $regex: /ct|mri|x[\s-]?ray|ultrasound|imaging/i },
      status: "Scheduled",
    }),
  ]);

  return {
    pendingImagingStudies,
    completedImagingStudies,
    criticalFindingsBacklog,
  };
}

export default getRadiologySummary;
