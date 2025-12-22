// controllers/profileController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";

// ==========================
// GET PROFILE
// ==========================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// UPDATE PROFILE
// ==========================
export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// ENABLE 2FA
// ==========================
export const enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const secret = speakeasy.generateSecret({ length: 20 });
    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = true;

    await user.save();
    res.json({ message: "2FA enabled", secret: secret.otpauth_url });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// DISABLE 2FA (WITH PASSWORD CHECK + ADMIN OVERRIDE)
// ==========================
export const disable2FA = async (req, res) => {
  try {
    const { password, userId } = req.body;
    let user;

    // Admin override
    if (userId && req.user.role === "SuperAdmin") {
      user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
    } else {
      // Regular user disabling own 2FA
      user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Incorrect password" });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;

    await user.save();
    res.json({ message: "2FA disabled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// CHANGE PASSWORD
// ==========================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// UPDATE SECURITY SETTINGS
// ==========================
export const updateSecuritySettings = async (req, res) => {
  try {
    const { notifyOnLogin } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (notifyOnLogin !== undefined) user.metadata.notifyOnLogin = notifyOnLogin;

    await user.save();
    res.json({ message: "Security settings updated", settings: { notifyOnLogin } });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
