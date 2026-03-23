// controllers/profileController.js
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { normalizeRole } from "../utils/normalizeRole.js";
import { getVerificationWarning } from "../services/verificationReminderService.js";
import {
  buildLinkedMinorSummariesForUser,
  isMinorDob,
  searchMinorPatientsForGuardian,
} from "../services/familyMonitoringService.js";
import { audit } from "../utils/audit.js";

// ==========================
// GET PROFILE
// ==========================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("+password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    const verificationWarning = getVerificationWarning(user);
    const linkedMinorSummaries = await buildLinkedMinorSummariesForUser(user._id);
    const profile = user.toObject();
    profile.hasPassword = Boolean(user.password);
    delete profile.password;
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

    profile.familyMonitoring = profile.familyMonitoring || {};
    profile.familyMonitoring.preferences = {
      receiveMinorAlerts: profile.familyMonitoring?.preferences?.receiveMinorAlerts !== false,
      showDailyMinorSummary: profile.familyMonitoring?.preferences?.showDailyMinorSummary !== false,
    };
    profile.linkedMinorSummaries = linkedMinorSummaries;

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
      insuranceProfile,
      systemProfile,
      uiPreferences,
      familyMonitoringPreferences,
    } = req.body;
    const user = await User.findById(req.user.id).select("+twoFactorSecret +twoFactorTempSecret");
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

    if (uiPreferences && typeof uiPreferences === "object") {
      user.uiPreferences = {
        ...user.uiPreferences,
        ...uiPreferences,
      };
    }

    if (familyMonitoringPreferences && typeof familyMonitoringPreferences === "object") {
      user.familyMonitoring = user.familyMonitoring || {};
      user.familyMonitoring.preferences = {
        ...user.familyMonitoring?.preferences,
        ...familyMonitoringPreferences,
      };
    }

    if (insuranceProfile && typeof insuranceProfile === "object") {
      user.insuranceProfile = {
        ...user.insuranceProfile,
        ...insuranceProfile,
        updatedAt: new Date(),
      };
    }

    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getFamilyMonitoring = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("familyMonitoring");
    if (!user) return res.status(404).json({ message: "User not found" });

    const items = await buildLinkedMinorSummariesForUser(user._id);
    return res.json({
      items,
      preferences: {
        receiveMinorAlerts: user.familyMonitoring?.preferences?.receiveMinorAlerts !== false,
        showDailyMinorSummary: user.familyMonitoring?.preferences?.showDailyMinorSummary !== false,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load family monitoring", error: err.message });
  }
};

export const searchMinorProfiles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("hospital role familyMonitoring");
    if (!user) return res.status(404).json({ message: "User not found" });

    const query = String(req.query.q || "").trim();
    const dob = String(req.query.dob || "").trim();
    const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || user.role || "");
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(actorRole);
    const hospitalId = privileged ? req.query.hospitalId || user.hospital || null : user.hospital || null;

    if (!query || !dob) {
      return res.status(400).json({ message: "Child name and date of birth are required" });
    }
    if (!hospitalId) {
      return res.status(400).json({ message: "Your account must be linked to a hospital before family linking can be used" });
    }

    const items = await searchMinorPatientsForGuardian({
      user,
      query,
      dob,
      hospitalId,
    });
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to search minor profiles", error: err.message });
  }
};

export const linkMinorProfile = async (req, res) => {
  try {
    const { patientId, relationship = "PARENT", notes = "" } = req.body || {};
    if (!patientId) {
      return res.status(400).json({ message: "Patient is required" });
    }

    const [user, patient] = await Promise.all([
      User.findById(req.user.id).select("hospital familyMonitoring"),
      Patient.findById(patientId).select("firstName lastName dob hospital guardianLinks active"),
    ]);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!patient || !patient.active) return res.status(404).json({ message: "Patient not found" });
    if (!isMinorDob(patient.dob)) {
      return res.status(400).json({ message: "Only minors under 18 can be linked to a guardian account" });
    }

    const actorRole = normalizeRole(req.user?.actualRole || req.user?.role || "");
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(actorRole);
    if (!privileged && String(user.hospital || "") !== String(patient.hospital || "")) {
      return res.status(403).json({ message: "You can only link minors from your own hospital" });
    }

    const userLinks = user.familyMonitoring?.linkedMinorPatients || [];
    if (userLinks.some((link) => String(link.patient) === String(patient._id) && String(link.status || "ACTIVE").toUpperCase() === "ACTIVE")) {
      return res.status(409).json({ message: "This child is already linked to your account" });
    }

    user.familyMonitoring = user.familyMonitoring || {};
    user.familyMonitoring.linkedMinorPatients = [
      ...userLinks.filter((link) => String(link.patient) !== String(patient._id)),
      {
        patient: patient._id,
        relationship: String(relationship || "PARENT").trim() || "PARENT",
        status: "ACTIVE",
        linkedAt: new Date(),
        linkedBy: req.user._id,
        notes: String(notes || "").trim(),
      },
    ];

    const guardianLinks = Array.isArray(patient.guardianLinks) ? patient.guardianLinks : [];
    const nextGuardianLinks = guardianLinks.filter((link) => String(link.user) !== String(user._id));
    nextGuardianLinks.push({
      user: user._id,
      relationship: String(relationship || "PARENT").trim() || "PARENT",
      status: "ACTIVE",
      canMonitor: true,
      linkedAt: new Date(),
      linkedBy: req.user._id,
      notes: String(notes || "").trim(),
    });
    patient.guardianLinks = nextGuardianLinks;

    await Promise.all([user.save(), patient.save()]);
    await audit({
      req,
      action: "LINK_MINOR_TO_GUARDIAN",
      resource: "Patient",
      resourceId: patient._id,
      metadata: {
        relationship: relationship || "PARENT",
        minorName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      },
    });

    const items = await buildLinkedMinorSummariesForUser(user._id);
    return res.status(201).json({ message: "Child linked to your account", items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to link child profile", error: err.message });
  }
};

export const unlinkMinorProfile = async (req, res) => {
  try {
    const { patientId } = req.params;
    const [user, patient] = await Promise.all([
      User.findById(req.user.id).select("familyMonitoring"),
      Patient.findById(patientId).select("firstName lastName guardianLinks"),
    ]);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    user.familyMonitoring = user.familyMonitoring || {};
    user.familyMonitoring.linkedMinorPatients = (user.familyMonitoring.linkedMinorPatients || []).map((link) =>
      String(link.patient) === String(patientId)
        ? { ...link.toObject?.() || link, status: "REMOVED" }
        : link
    );

    patient.guardianLinks = (patient.guardianLinks || []).map((link) =>
      String(link.user) === String(user._id)
        ? { ...link.toObject?.() || link, status: "REMOVED", canMonitor: false }
        : link
    );

    await Promise.all([user.save(), patient.save()]);
    await audit({
      req,
      action: "UNLINK_MINOR_FROM_GUARDIAN",
      resource: "Patient",
      resourceId: patient._id,
      metadata: {
        minorName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      },
    });

    const items = await buildLinkedMinorSummariesForUser(user._id);
    return res.json({ message: "Child removed from your monitoring list", items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to unlink child profile", error: err.message });
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
      user = await User.findById(req.user.id).select("+password +twoFactorSecret +twoFactorTempSecret");
      if (!user) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Incorrect password" });
    }

    user.twoFactorEnabled = false;
    user.twoFactorMethod = "OTP";
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    user.twoFactorRecoveryCodes = [];

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
