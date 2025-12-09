const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const { auth, permit } = require('../middleware/auth');

const router = express.Router();

// --- Login ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ msg: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: user.role });
});

// --- Super Admin creates Hospital Admin ---
router.post('/register', auth, async (req, res) => {
  const { name, email, password, role, hospitalId } = req.body;

  // Only superadmin can create hospitaladmin
  if (role === 'hospitaladmin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ msg: 'Only Super Admin can create Hospital Admin' });
  }

  // Hospital admin/staff creation
  if (['doctor','nurse','labtech'].includes(role) && req.user.role !== 'hospitaladmin') {
    return res.status(403).json({ msg: 'Only Hospital Admin can create staff' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ msg: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);

  const newUser = new User({ name, email, password: hashed, role });

  if (role === 'hospitaladmin' && hospitalId) {
    // Create hospital and link admin
    const hospital = new Hospital({ name: req.body.hospitalName, admins: [] });
    await hospital.save();
    newUser.hospital = hospital._id;
    hospital.admins.push(newUser._id);
    await hospital.save();
  }

  if (['doctor','nurse','labtech'].includes(role)) {
    newUser.hospital = req.user.hospital; // inherit hospital from admin
  }

  await newUser.save();

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, role: newUser.role });
});

// --- List users by role ---
router.get('/users', auth, async (req, res) => {
  const { role, hospital } = req.query;
  let query = {};
  if (role) query.role = role;
  if (hospital) query.hospital = req.user.hospital;

  const users = await User.find(query).select('-password').sort({ createdAt: -1 });
  res.json(users);
});

module.exports = router;
