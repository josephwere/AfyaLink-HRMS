import User from "../../models/User.js";

export async function findActiveDoctors(hospitalId) {
  return User.find({
    hospital: hospitalId,
    role: { $in: ["DOCTOR", "SURGEON"] },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
  })
    .select("_id name employment.department")
    .lean();
}

export async function findDoctorById(doctorId, hospitalId) {
  return User.findOne({
    _id: doctorId,
    hospital: hospitalId,
    role: { $in: ["DOCTOR", "SURGEON"] },
    active: true,
    "employment.status": { $ne: "INACTIVE" },
  })
    .select("_id name employment.department")
    .lean();
}
