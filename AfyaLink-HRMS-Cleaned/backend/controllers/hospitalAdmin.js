const User = require("../models/User");
const Hospital = require("../models/Hospital");
const jwt = require("jsonwebtoken");

// Register staff: doctor, nurse, labtech
exports.registerStaff = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) return res.status(400).json({ msg: "All fields required" });
  if (!["doctor","nurse","labtech"].includes(role)) return res.status(400).json({ msg: "Invalid role" });

  try {
    if (await User.findOne({ email })) return res.status(400).json({ msg: "Email already exists" });

    const staff = await User.create({ name, email, password, role, hospital: req.user.hospital });
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Get all hospital staff
exports.getHospitalStaff = async (req, res) => {
  try {
    const staff = await User.find({ hospital: req.user.hospital, role: { $in: ["doctor","nurse","labtech"] } }).select("-password");
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
