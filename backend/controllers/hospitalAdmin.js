// backend/controllers/hospitalAdmin.js
import User from '../models/User.js';
import Staff from "../models/Staff.js";
import { STAFF_ROLES } from "../utils/roleSets.js";
import { evaluateStaffIdentityChecklist } from "../utils/staffIdentityChecklist.js";

// Register staff: doctor, nurse, labtech
const STAFF_ROLE_MAP = {
  doctor: "DOCTOR",
  hospital_admin_assistant: "HOSPITAL_ADMIN_ASSISTANT",
  admin_assistant: "HOSPITAL_ADMIN_ASSISTANT",
  surgeon: "SURGEON",
  nurse: "NURSE",
  labtech: "LAB_TECH",
  lab_tech: "LAB_TECH",
  pharmacist: "PHARMACIST",
  radiologist: "RADIOLOGIST",
  therapist: "THERAPIST",
  receptionist: "RECEPTIONIST",
  security_officer: "SECURITY_OFFICER",
  security_admin: "SECURITY_ADMIN",
  hr_manager: "HR_MANAGER",
  payroll_officer: "PAYROLL_OFFICER",
  community_health_worker: "COMMUNITY_HEALTH_WORKER",
  chw: "COMMUNITY_HEALTH_WORKER",
};
const STAFF_ROLES_SET = new Set(STAFF_ROLES);
const STRICT_STAFF_IDENTITY_ONBOARDING = ["1", "true", "yes"].includes(
  String(process.env.STRICT_STAFF_IDENTITY_ONBOARDING || "").toLowerCase()
);

async function upsertStaffProfile(user, checklist = null) {
  if (!user?.hospital || !STAFF_ROLES_SET.has(String(user.role || "").toUpperCase())) return null;
  return Staff.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        role: user.role,
        hospital: user.hospital,
        status: user?.employment?.status || "ACTIVE",
        employeeId: user?.employment?.employeeId || "",
        department: user?.employment?.department || "",
        licenseNumber: user?.licenseNumber || "",
        licenseExpiry: user?.licenseExpiry || null,
        checklist: checklist
          ? {
              compliant: Boolean(checklist.compliant),
              completionRate: Number(checklist.completionRate || 0),
              missingKeys: checklist.missingKeys || [],
              missingLabels: checklist.missingLabels || [],
              evaluatedAt: new Date(),
            }
          : undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const registerStaff = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    phone,
    nationalIdNumber,
    nationalIdCountry,
    licenseNumber,
    licenseExpiry,
    employeeId,
    credentials,
  } = req.body;

  if (!name || !email || !password || !role) return res.status(400).json({ msg: "All fields required" });
  const normalizedRole = STAFF_ROLE_MAP[String(role).toLowerCase()];
  if (!normalizedRole) return res.status(400).json({ msg: "Invalid role" });

  try {
    if (await User.findOne({ email })) return res.status(400).json({ msg: "Email already exists" });

    const candidate = {
      name,
      email,
      password,
      role: normalizedRole,
      hospital: req.user.hospital || req.user.hospitalId || req.body?.hospitalId,
      phone: phone ? String(phone).trim() : undefined,
      nationalIdNumber: nationalIdNumber ? String(nationalIdNumber).trim().toUpperCase() : undefined,
      nationalIdCountry: nationalIdCountry ? String(nationalIdCountry).trim().toUpperCase() : undefined,
      licenseNumber: licenseNumber ? String(licenseNumber).trim().toUpperCase() : undefined,
      licenseExpiry: licenseExpiry || undefined,
      employment: {
        employeeId: employeeId ? String(employeeId).trim() : undefined,
        status: "ACTIVE",
      },
      credentials: credentials && typeof credentials === "object" ? credentials : undefined,
      emailVerified: true,
    };

    const checklist = evaluateStaffIdentityChecklist(candidate);
    if (STRICT_STAFF_IDENTITY_ONBOARDING && !checklist.compliant) {
      return res.status(422).json({ msg: "Identity checklist incomplete for selected role", checklist });
    }

    const staff = await User.create(candidate);
    await upsertStaffProfile(staff, checklist);
    res.status(201).json({
      success: true,
      msg: checklist.compliant
        ? "Staff registered"
        : "Staff registered. Complete the identity checklist before production access.",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        checklist,
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
    const staff = await User.find({
      hospital: req.user.hospital,
      role: {
        $in: [
          "DOCTOR",
          "HOSPITAL_ADMIN_ASSISTANT",
          "SURGEON",
          "NURSE",
          "LAB_TECH",
          "PHARMACIST",
          "RADIOLOGIST",
          "THERAPIST",
          "RECEPTIONIST",
          "SECURITY_OFFICER",
          "SECURITY_ADMIN",
          "HR_MANAGER",
          "PAYROLL_OFFICER",
          "COMMUNITY_HEALTH_WORKER",
        ],
      },
    }).select("-password");
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
