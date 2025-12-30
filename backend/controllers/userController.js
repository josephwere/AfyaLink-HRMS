import User from "../models/User.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";

/**
 * GET /api/users/me
 * Logged-in user profile
 */
export const getMe = async (req, res, next) => {
  try {
    if (!req.user.active) {
      return res.status(403).json({
        message: "Account inactive",
      });
    }

    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users
 * List ACTIVE users within SAME hospital only
 */
export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find({
      hospital: req.user.hospitalId, // 🔐 tenant scoped
      active: true,                 // 🔒 soft-delete filter
    })
      .select("-password")
      .limit(500);

    res.json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Update user (same hospital only, active only)
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // 🔐 Password changes handled elsewhere
    delete updates.password;
    delete updates.hospital;
    delete updates.active;

    const user = await User.findById(id);

    if (!user || !user.active) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 TENANT ISOLATION (CRITICAL)
    if (
      user.hospital.toString() !==
      req.user.hospitalId.toString()
    ) {
      await denyAudit(
        req,
        res,
        "Cross-hospital user update blocked"
      );

      return res.status(403).json({
        message: "Access denied",
      });
    }

    Object.assign(user, updates);
    await user.save();

    await audit({
      req,
      action: "UPDATE_USER",
      resource: "User",
      resourceId: user._id,
    });

    res.json(
      user.toObject({ getters: true, versionKey: false })
    );
  } catch (err) {
    next(err);
  }
};

/**
 * DEACTIVATE USER (SOFT DELETE)
 * ✔ audit-safe
 * ✔ tenant-safe
 * ✔ reversible
 */
export const deactivateUser = async (req, res, next) => {
  try {
    // 🚫 Prevent self-deactivation
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        hospital: req.user.hospitalId, // 🔐 tenant scoped
        active: true,
      },
      { active: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await audit({
      req,
      action: "DEACTIVATE_USER",
      resource: "User",
      resourceId: user._id,
    });

    res.json({
      message: "User deactivated",
    });
  } catch (err) {
    next(err);
  }
};
