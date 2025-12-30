import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

/**
 * CREATE ADMIN (SUPER_ADMIN ONLY)
 * Role allowed: HOSPITAL_ADMIN
 * Enforces: email verified + 2FA required
 */
export const createAdmin = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!["HOSPITAL_ADMIN"].includes(role)) {
      return res.status(400).json({ msg: "Invalid admin role" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ msg: "Email already in use" });
    }

    const user = await User.create({
      name,
      email,
      role,
      password: Math.random().toString(36).slice(-12), // temp password
      emailVerified: true,
      twoFactorEnabled: true, // 🔐 force 2FA
      protectedAccount: true,
    });

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "ADMIN_CREATED",
      resource: "User",
      resourceId: user._id,
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
