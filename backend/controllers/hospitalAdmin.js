// backend/controllers/hospitalAdmin.js
import User from '../models/User.js';

// Register staff: doctor, nurse, labtech
const STAFF_ROLE_MAP = {
  doctor: "DOCTOR",
  nurse: "NURSE",
  labtech: "LAB_TECH",
  lab_tech: "LAB_TECH",
  pharmacist: "PHARMACIST",
  radiologist: "RADIOLOGIST",
  therapist: "THERAPIST",
  receptionist: "RECEPTIONIST",
  security_officer: "SECURITY_OFFICER",
  hr_manager: "HR_MANAGER",
  payroll_officer: "PAYROLL_OFFICER",
};

export const registerStaff = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) return res.status(400).json({ msg: "All fields required" });
  const normalizedRole = STAFF_ROLE_MAP[String(role).toLowerCase()];
  if (!normalizedRole) return res.status(400).json({ msg: "Invalid role" });

  try {
    if (await User.findOne({ email })) return res.status(400).json({ msg: "Email already exists" });

    const staff = await User.create({
      name,
      email,
      password,
      role: normalizedRole,
      hospital: req.user.hospital,
      emailVerified: true,
    });
    res.status(201).json({
      success: true,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all hospital staff
export const getHospitalStaff = async (req, res) => {
  try {
    const staff = await User.find({ hospital: req.user.hospital, role: { $in: ["DOCTOR","NURSE","LAB_TECH"] } }).select("-password");
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
