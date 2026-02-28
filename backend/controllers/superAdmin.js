// backend/controllers/superAdmin.js
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

// Create a Hospital Admin
export const registerHospitalAdmin = async (req, res) => {
  const { name, email, password, hospitalId, branch } = req.body;

  if (!name || !email || !password || !hospitalId) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    // Check email uniqueness
    if (await User.findOne({ email })) return res.status(400).json({ msg: "Email already exists" });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ msg: "Hospital not found" });

    // Create hospital admin
    const admin = await User.create({
      name,
      email,
      password,
      role: "HOSPITAL_ADMIN",
      hospital: hospital._id,
      employment: {
        ...(branch ? { branch: String(branch).trim() } : {}),
      },
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
    });
    hospital.admins = hospital.admins || [];
    if (!hospital.admins.some((id) => String(id) === String(admin._id))) {
      hospital.admins.push(admin._id);
    }
    await hospital.save();

    // Return admin summary
    res.status(201).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        hospital: hospital._id,
        branch: admin?.employment?.branch || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create another system admin (SUPER_ADMIN)
export const registerSystemAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "SYSTEM_ADMIN",
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
    });

    res.status(201).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Create a developer (DEVELOPER)
export const registerDeveloper = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ msg: "All fields are required" });
  }

  try {
    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const dev = await User.create({
      name,
      email,
      password,
      role: "DEVELOPER",
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
    });

    res.status(201).json({
      success: true,
      admin: {
        id: dev._id,
        name: dev.name,
        email: dev.email,
        role: dev.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all hospitals
export const getHospitals = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const withoutAdmin = String(req.query.withoutAdmin || "").toLowerCase() === "true";

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { contact: { $regex: q, $options: "i" } },
      ];
    }

    if (withoutAdmin) {
      filter.$or = filter.$or || [];
      const noAdminsClauses = [{ admins: { $exists: false } }, { admins: { $size: 0 } }];
      if (filter.$or.length) {
        filter.$and = [{ $or: filter.$or }, { $or: noAdminsClauses }];
        delete filter.$or;
      } else {
        filter.$or = noAdminsClauses;
      }
    }

    const [rows, total] = await Promise.all([
      Hospital.find(filter)
        .populate("admins", "name email employment.branch")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Hospital.countDocuments(filter),
    ]);

    const now = new Date();
    const items = rows.map((h) => {
      const trialEndsAt = h?.subscription?.trialEndsAt ? new Date(h.subscription.trialEndsAt) : null;
      const status = h?.subscription?.status || "TRIAL";
      const paid = status === "ACTIVE";
      const trialExpired = trialEndsAt ? now > trialEndsAt : false;
      const premiumPaused = Boolean(h?.subscription?.premiumPaused) || (trialExpired && !paid);
      return {
        ...h,
        subscriptionState: {
          status,
          trialEndsAt,
          trialExpired,
          premiumPaused,
          daysLeft: trialEndsAt
            ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : 0,
        },
      };
    });

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// List hospital admins with hospital/branch/search filters
export const listHospitalAdmins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const hospitalId = req.query.hospitalId;
    const branch = (req.query.branch || "").trim();
    const q = (req.query.q || "").trim();

    const filter = { role: "HOSPITAL_ADMIN" };
    if (hospitalId) filter.hospital = hospitalId;
    if (branch) filter["employment.branch"] = branch;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name email hospital employment.branch active createdAt")
        .populate("hospital", "name code")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

export const updateHospitalAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, branch, active } = req.body || {};

    const admin = await User.findOne({ _id: id, role: "HOSPITAL_ADMIN" });
    if (!admin) {
      return res.status(404).json({ msg: "Hospital admin not found" });
    }

    if (name !== undefined) admin.name = String(name).trim();
    if (email !== undefined) admin.email = String(email).trim().toLowerCase();
    if (branch !== undefined) {
      admin.employment = admin.employment || {};
      admin.employment.branch = String(branch || "").trim();
    }
    if (active !== undefined) admin.active = Boolean(active);

    await admin.save();

    const out = await User.findById(admin._id)
      .select("name email hospital employment.branch active createdAt")
      .populate("hospital", "name code")
      .lean();

    return res.json({ success: true, admin: out });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ msg: "Email already exists" });
    }
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
};
