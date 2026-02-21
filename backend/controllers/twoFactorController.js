import crypto from "crypto";
import speakeasy from "speakeasy";
import User from "../models/User.js";
import { logAudit } from "../services/auditService.js";
import { appendComplianceLedger } from "../utils/complianceLedger.js";

const RECOVERY_CODE_COUNT = 8;

function buildRecoveryCodes() {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
  const hashed = plain.map((c) =>
    crypto.createHash("sha256").update(c).digest("hex")
  );
  return { plain, hashed };
}

async function write2faAudit(user, action, metadata = {}) {
  await logAudit({
    actorId: user._id,
    actorRole: user.role,
    action,
    resource: "User",
    resourceId: user._id,
    hospital: user.hospital || null,
    success: true,
    after: metadata,
  });
  await appendComplianceLedger({
    actorId: user._id,
    actorRole: user.role,
    action,
    resource: "User",
    resourceId: user._id,
    hospital: user.hospital || null,
    metadata,
  });
}

export const get2FAStatus = async (req, res) => {
  const user = await User.findById(req.user.id).select(
    "twoFactorEnabled twoFactorMethod"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });
  return res.json({
    enabled: Boolean(user.twoFactorEnabled),
    method: user.twoFactorMethod || "OTP",
  });
};

export const toggle2FA = async (req, res) => {
  const { enabled } = req.body || {};
  const user = await User.findById(req.user.id).select(
    "+twoFactorSecret +twoFactorTempSecret +twoFactorRecoveryCodes twoFactorEnabled twoFactorMethod"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });

  if (enabled === false) {
    user.twoFactorEnabled = false;
    user.twoFactorMethod = "OTP";
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();
    await write2faAudit(user, "2FA_DISABLED", { method: "OTP" });
    return res.json({ enabled: false, method: "OTP" });
  }

  // Backward-compatible toggle ON for OTP flow.
  user.twoFactorEnabled = true;
  if (!user.twoFactorMethod) user.twoFactorMethod = "OTP";
  await user.save();
  await write2faAudit(user, "2FA_ENABLED", { method: user.twoFactorMethod });
  return res.json({ enabled: true, method: user.twoFactorMethod });
};

export const setupTOTP = async (req, res) => {
  const user = await User.findById(req.user.id).select(
    "+twoFactorSecret +twoFactorTempSecret twoFactorMethod twoFactorEnabled email"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });

  const label = user.email || `user-${String(user._id)}`;
  const secret = speakeasy.generateSecret({
    name: `AfyaLink (${label})`,
    issuer: "AfyaLink",
    length: 20,
  });

  user.twoFactorTempSecret = secret.base32;
  await user.save();

  await write2faAudit(user, "2FA_TOTP_SETUP_STARTED", { method: "TOTP" });
  return res.json({
    success: true,
    method: "TOTP",
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  });
};

export const verifyTOTPSetup = async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ msg: "Code is required" });

  const user = await User.findById(req.user.id).select(
    "+twoFactorSecret +twoFactorTempSecret +twoFactorRecoveryCodes"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!user.twoFactorTempSecret) {
    return res.status(400).json({ msg: "TOTP setup not initialized" });
  }

  const valid = speakeasy.totp.verify({
    secret: user.twoFactorTempSecret,
    encoding: "base32",
    token: String(code).trim(),
    window: 1,
  });
  if (!valid) return res.status(400).json({ msg: "Invalid authenticator code" });

  const recovery = buildRecoveryCodes();
  user.twoFactorSecret = user.twoFactorTempSecret;
  user.twoFactorTempSecret = null;
  user.twoFactorEnabled = true;
  user.twoFactorMethod = "TOTP";
  user.twoFactorRecoveryCodes = recovery.hashed;
  await user.save();

  await write2faAudit(user, "2FA_TOTP_ENABLED", {
    method: "TOTP",
    recoveryCodes: RECOVERY_CODE_COUNT,
  });
  return res.json({
    success: true,
    enabled: true,
    method: "TOTP",
    recoveryCodes: recovery.plain,
  });
};

export const regenerateRecoveryCodes = async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ msg: "Code is required" });

  const user = await User.findById(req.user.id).select(
    "+twoFactorSecret +twoFactorRecoveryCodes twoFactorEnabled twoFactorMethod"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!user.twoFactorEnabled || user.twoFactorMethod !== "TOTP" || !user.twoFactorSecret) {
    return res.status(400).json({ msg: "TOTP is not enabled" });
  }

  const valid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token: String(code).trim(),
    window: 1,
  });
  if (!valid) return res.status(400).json({ msg: "Invalid authenticator code" });

  const recovery = buildRecoveryCodes();
  user.twoFactorRecoveryCodes = recovery.hashed;
  await user.save();

  await write2faAudit(user, "2FA_TOTP_RECOVERY_REGENERATED", {
    method: "TOTP",
  });
  return res.json({
    success: true,
    recoveryCodes: recovery.plain,
  });
};

export const disable2FASetting = async (req, res) => {
  const { code, recoveryCode } = req.body || {};
  const user = await User.findById(req.user.id).select(
    "+twoFactorSecret +twoFactorRecoveryCodes twoFactorEnabled twoFactorMethod"
  );
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!user.twoFactorEnabled) return res.json({ success: true, enabled: false });

  if (user.twoFactorMethod === "TOTP") {
    let valid = false;
    if (code && user.twoFactorSecret) {
      valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: String(code).trim(),
        window: 1,
      });
    }
    if (!valid && recoveryCode) {
      const hashed = crypto
        .createHash("sha256")
        .update(String(recoveryCode).trim().toUpperCase())
        .digest("hex");
      const idx = (user.twoFactorRecoveryCodes || []).findIndex((h) => h === hashed);
      if (idx >= 0) {
        user.twoFactorRecoveryCodes.splice(idx, 1);
        valid = true;
      }
    }
    if (!valid) {
      return res.status(400).json({ msg: "Authenticator code or recovery code required" });
    }
  }

  user.twoFactorEnabled = false;
  user.twoFactorMethod = "OTP";
  user.twoFactorSecret = null;
  user.twoFactorTempSecret = null;
  user.twoFactorRecoveryCodes = [];
  await user.save();

  await write2faAudit(user, "2FA_DISABLED", { method: "OTP" });
  return res.json({ success: true, enabled: false, method: "OTP" });
};
