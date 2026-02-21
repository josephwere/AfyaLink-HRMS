import User from "../models/User.js";

const STAFF_ROLES = [
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
];

function resolveHospital(req) {
  if (req.user?.role === "SUPER_ADMIN" && req.query.hospitalId) {
    return req.query.hospitalId;
  }
  return req.user?.hospital || req.user?.hospitalId;
}

export const getAllStaff = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = (req.query.q || "").trim();
    const role = (req.query.role || "").toUpperCase();

    const filter = {
      hospital,
      role: STAFF_ROLES.includes(role) ? role : { $in: STAFF_ROLES },
      active: { $ne: false },
    };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("-password -refreshTokens -trustedDevices -emergencyAccess")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to fetch staff" });
  }
};

export const getStaffById = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const item = await User.findOne({
      _id: req.params.id,
      hospital,
      role: { $in: STAFF_ROLES },
    }).select("-password -refreshTokens -trustedDevices -emergencyAccess");

    if (!item) return res.status(404).json({ msg: "Staff not found" });
    return res.json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to fetch staff member" });
  }
};

export const createStaff = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const { name, email, password, role } = req.body;
    const normalizedRole = String(role || "").toUpperCase();
    if (!name || !email || !password || !STAFF_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ msg: "Invalid staff payload" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ msg: "Email already exists" });

    const created = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: normalizedRole,
      hospital,
      emailVerified: true,
      active: true,
    });

    return res.status(201).json({
      id: created._id,
      name: created.name,
      email: created.email,
      role: created.role,
      hospital: created.hospital,
      active: created.active,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to create staff" });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.role !== undefined) {
      const normalizedRole = String(req.body.role).toUpperCase();
      if (!STAFF_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ msg: "Invalid role" });
      }
      updates.role = normalizedRole;
    }
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);

    const item = await User.findOneAndUpdate(
      { _id: req.params.id, hospital, role: { $in: STAFF_ROLES } },
      updates,
      { new: true }
    ).select("-password -refreshTokens -trustedDevices -emergencyAccess");

    if (!item) return res.status(404).json({ msg: "Staff not found" });
    return res.json(item);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to update staff" });
  }
};

export const deactivateStaff = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const item = await User.findOneAndUpdate(
      { _id: req.params.id, hospital, role: { $in: STAFF_ROLES } },
      { active: false },
      { new: true }
    ).select("-password -refreshTokens -trustedDevices -emergencyAccess");

    if (!item) return res.status(404).json({ msg: "Staff not found" });
    return res.json({ success: true, staff: item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to deactivate staff" });
  }
};
