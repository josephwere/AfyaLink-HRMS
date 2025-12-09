const User = require("../models/User");
const Hospital = require("../models/Hospital");
const jwt = require("jsonwebtoken");

// Create a Hospital Admin
exports.registerHospitalAdmin = async (req, res) => {
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
    const admin = await User.create({ name, email, password, role: "hospitaladmin", hospital: hospital._id });
    hospital.admins.push(admin._id);
    await hospital.save();

    // Return token
    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all hospitals
exports.getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find().populate("admins", "name email");
    res.json(hospitals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
