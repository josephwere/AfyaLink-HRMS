import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";

/**
 * CREATE ADMIN (SUPER_ADMIN ONLY)
 * Role allowed: HOSPITAL_ADMIN
 * Enforces:
 * - Hospital user limits
 * - Email verified
 * - 2FA required
 * - Soft-delete safe
 */
export const createAdmin = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    /* ================= ROLE CHECK ================= */
    if (!["HOSPITAL_ADMIN"].includes(role)) {
      return res.status(400).json({ msg: "Invalid admin role" });
    }

    /* ================= EMAIL UNIQUE ================= */
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ msg: "Email already in use" });
    }

    /* ================= LOAD HOSPITAL ================= */
    const hospital = await Hospital.findOne({
      _id: req.user.hospital,
      active: true, // 🔒 soft-delete safe
    }).lean();

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found or inactive" });
    }

    /* ================= USER LIMIT ENFORCEMENT ================= */
    const activeUsers = await User.countDocuments({
      hospital: hospital._id,
      active: true,
    });

    if (activeUsers >= hospital.limits.users) {
      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: "USER_LIMIT_EXCEEDED",
        resource: "Hospital",
        resourceId: hospital._id,
        success: false,
        error: "Hospital user limit reached",
      });

      return res.status(403).json({
        msg: "User limit reached for this hospital plan",
      });
    }

    /* ================= CREATE ADMIN ================= */
    const user = await User.create({
      name,
      email,
      role,
      hospital: hospital._id,
      password: Math.random().toString(36).slice(-12), // temp password
      emailVerified: true,
      twoFactorEnabled: true, // 🔐 force 2FA
      protectedAccount: true,
      active: true,
    });

    /* ================= AUDIT ================= */
    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ADMIN_CREATED",
      resource: "User",
      resourceId: user._id,
      hospital: hospital._id,
      metadata: { role },
    });

    res.status(201).json({
      success: true,
      msg: "Admin created successfully",
      adminId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to create admin" });
  }
};
