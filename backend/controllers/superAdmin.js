// backend/controllers/superAdmin.js
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

// Create a Hospital Admin
export const registerHospitalAdmin = async (req, res) => {
  const { name, email, password, hospitalId } = req.body;

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
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
    });
    hospital.admins.push(admin._id);
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
    const hospitals = await Hospital.find().populate("admins", "name email");
    res.json(hospitals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
