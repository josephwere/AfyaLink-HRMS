import User from "../models/User.js";
import { denyAudit } from "../middleware/denyAudit.js";

/**
 * GET /api/users/me
 * Logged-in user profile
 */
export const getMe = async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users
 * List users within SAME hospital only
 */
export const listUsers = async (req, res, next) => {
  try {
    // 🔐 Tenant isolation
    const users = await User.find({
      hospital: req.user.hospitalId,
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
 * Update user (same hospital only)
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // 🔐 Password changes handled elsewhere
    if (updates.password) delete updates.password;

    const user = await User.findById(id);

    if (!user) {
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

    res.json(
      user.toObject({ getters: true, versionKey: false })
    );
  } catch (err) {
    next(err);
  }
};
