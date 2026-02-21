// controllers/profileController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { normalizeRole } from "../utils/normalizeRole.js";
import { getVerificationWarning } from "../services/verificationReminderService.js";

// ==========================
// GET PROFILE
// ==========================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    const verificationWarning = getVerificationWarning(user);
    const profile = user.toObject();
    profile.systemProfile = profile.systemProfile || {};
    profile.systemProfile.lastActivityAt = user.updatedAt || user.createdAt;
    profile.systemProfile.deviceLogsCount = Array.isArray(user.trustedDevices)
      ? user.trustedDevices.length
      : 0;
    profile.systemProfile.loginHistory = (user.trustedDevices || [])
      .slice(-10)
      .map((d) => ({
        deviceId: d.deviceId,
        userAgent: d.userAgent,
        lastUsed: d.lastUsed,
        verifiedAt: d.verifiedAt,
      }))
      .sort((a, b) => new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0));

    res.json({ ...profile, verificationWarning });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ==========================
// UPDATE PROFILE
// ==========================
export const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      nationalIdNumber,
      nationalIdCountry,
      licenseNumber,
      licenseExpiry,
      gender,
      dateOfBirth,
      nationality,
      address,
      emergencyContact,
      employment,
      credentials,
      financial,
      systemProfile,
    } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (nationalIdNumber !== undefined) user.nationalIdNumber = nationalIdNumber;
    if (nationalIdCountry !== undefined) user.nationalIdCountry = nationalIdCountry;
    if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
    if (licenseExpiry !== undefined) user.licenseExpiry = licenseExpiry || null;
    if (gender !== undefined) user.gender = gender || undefined;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
    if (nationality !== undefined) user.nationality = nationality;
    if (address !== undefined) user.address = address;

    if (emergencyContact && typeof emergencyContact === "object") {
      user.emergencyContact = {
        ...user.emergencyContact,
        ...emergencyContact,
      };
    }

    if (employment && typeof employment === "object") {
      user.employment = {
        ...user.employment,
        ...employment,
      };
    }

    if (credentials && typeof credentials === "object") {
      user.credentials = {
        ...user.credentials,
        ...credentials,
        certifications: Array.isArray(credentials.certifications)
          ? credentials.certifications
          : user.credentials?.certifications || [],
        educationHistory: Array.isArray(credentials.educationHistory)
          ? credentials.educationHistory
          : user.credentials?.educationHistory || [],
        documents: Array.isArray(credentials.documents)
          ? credentials.documents
          : user.credentials?.documents || [],
      };
    }

    if (financial && typeof financial === "object") {
      user.financial = {
        ...user.financial,
        ...financial,
      };
    }

    if (systemProfile && typeof systemProfile === "object") {
      user.systemProfile = {
        ...user.systemProfile,
        ...systemProfile,
      };
    }

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
    if (userId && normalizeRole(req.user.role) === "SUPER_ADMIN") {
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
