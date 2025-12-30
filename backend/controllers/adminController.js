import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import AuditLog from "../models/AuditLog.js";

/* ======================================================
   CREATE ADMIN (SUPER_ADMIN ONLY)
====================================================== */
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

    const hospital = await Hospital.findOne({
      _id: req.user.hospital,
      active: true,
    }).lean();

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found or inactive" });
    }

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
      });

      return res.status(403).json({
        msg: "User limit reached for this hospital plan",
      });
    }

    const user = await User.create({
      name,
      email,
      role,
      hospital: hospital._id,
      password: Math.random().toString(36).slice(-12),
      emailVerified: true,
      twoFactorEnabled: true,
      protectedAccount: true,
      active: true,
    });

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

/* ======================================================
   🚨 SUPERADMIN — LIVE EMERGENCY DASHBOARD
   Shows ALL hospitals currently in break-glass
====================================================== */
export const listEmergencyAccess = async (req, res) => {
  try {
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Access denied" });
    }

    const emergencies = await AuditLog.find({
      action: "BREAK_GLASS_ACTIVATED",
      success: true,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actorId", "name email role")
      .populate("hospital", "name code plan")
      .lean();

    const activeEmergencies = emergencies.map((e) => {
      const expiresAt = new Date(e.metadata?.expiresAt);
      const active = expiresAt && expiresAt > new Date();

      return {
        hospital: e.hospital,
        activatedBy: e.actorId,
        reason: e.metadata?.reason,
        startedAt: e.createdAt,
        expiresAt,
        active,
      };
    });

    res.json({
      count: activeEmergencies.length,
      emergencies: activeEmergencies,
    });
  } catch (err) {
    console.error("Emergency dashboard error:", err);
    res.status(500).json({
      message: "Failed to load emergency dashboard",
    });
  }
};
