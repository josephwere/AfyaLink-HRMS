import User from "../models/User.js";
import { STAFF_ROLES } from "../utils/roleSets.js";
import { evaluateStaffIdentityChecklist } from "../utils/staffIdentityChecklist.js";

const STAFF_ROLES_SET = new Set(STAFF_ROLES);

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
    const normalizedRole = String(role || "").toUpperCase();
    if (!name || !email || !password || !STAFF_ROLES_SET.has(normalizedRole)) {
      return res.status(400).json({ msg: "Invalid staff payload" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ msg: "Email already exists" });

    const candidatePayload = {
      name,
      email: email.toLowerCase(),
      password,
      role: normalizedRole,
      hospital,
      phone: phone ? String(phone).trim() : undefined,
      nationalIdNumber: nationalIdNumber ? String(nationalIdNumber).trim().toUpperCase() : undefined,
      nationalIdCountry: nationalIdCountry ? String(nationalIdCountry).trim().toUpperCase() : undefined,
      licenseNumber: licenseNumber ? String(licenseNumber).trim().toUpperCase() : undefined,
      licenseExpiry: licenseExpiry || undefined,
      emailVerified: true,
      active: true,
      employment: {
        employeeId: employeeId ? String(employeeId).trim() : undefined,
        status: "ACTIVE",
      },
      credentials: credentials && typeof credentials === "object" ? credentials : undefined,
    };
    const checklist = evaluateStaffIdentityChecklist(candidatePayload);
    if (!checklist.compliant) {
      return res.status(422).json({
        msg: "Identity checklist incomplete for selected role",
        checklist,
      });
    }

    const created = await User.create({
      ...candidatePayload,
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
      if (!STAFF_ROLES_SET.has(normalizedRole)) {
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

    const item = await User.findOne({
      _id: req.params.id,
      hospital,
      role: { $in: STAFF_ROLES },
    }).select("-password -refreshTokens -trustedDevices -emergencyAccess");

    if (!item) return res.status(404).json({ msg: "Staff not found" });
    item.role = "PATIENT";
    item.hospital = null;
    item.employment = item.employment || {};
    item.employment.status = "INACTIVE";
    item.employment.separationDate = new Date();
    item.employment.separationReason = "Removed from hospital staffing roster";
    item.active = true;
    await item.save();

    return res.json({ success: true, demotedTo: "PATIENT", staff: item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to deactivate staff" });
  }
};

export const getStaffIdentityChecklist = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const item = await User.findOne({
      _id: req.params.id,
      hospital,
      role: { $in: STAFF_ROLES },
    }).lean();

    if (!item) return res.status(404).json({ msg: "Staff not found" });
    const checklist = evaluateStaffIdentityChecklist(item);
    return res.json({
      staffId: item._id,
      name: item.name,
      role: item.role,
      checklist,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to evaluate identity checklist" });
  }
};

export const exportStaffIdentityChecklistCsv = async (req, res) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ msg: "Hospital context missing" });

    const users = await User.find({
      hospital,
      role: { $in: STAFF_ROLES },
      active: { $ne: false },
    })
      .select("name email role nationalIdNumber nationalIdCountry phoneVerified employment credentials licenseNumber licenseExpiry")
      .lean();

    const rows = [
      [
        "staffId",
        "name",
        "email",
        "role",
        "compliant",
        "completionRate",
        "missingItems",
      ],
    ];

    for (const user of users) {
      const checklist = evaluateStaffIdentityChecklist(user);
      rows.push([
        String(user._id),
        JSON.stringify(String(user.name || "")),
        JSON.stringify(String(user.email || "")),
        user.role,
        checklist.compliant ? "YES" : "NO",
        String(checklist.completionRate),
        JSON.stringify(checklist.missingLabels.join("; ")),
      ]);
    }

    const csv = rows.map((r) => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=staff-identity-checklist.csv");
    return res.status(200).send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Failed to export identity checklist" });
  }
};
