// backend/controllers/authController.js

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { redis } from "../utils/redis.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS } from "../services/notificationService.js";
import { setOtp, getOtp, delOtp } from "../services/otpStore.js";
import { appendComplianceLedger } from "../utils/complianceLedger.js";
import { assessLoginRisk, upsertTrustedDevice } from "../utils/sessionRisk.js";
import RiskAssessment from "../models/RiskAssessment.js";
import { getRiskPolicy } from "../utils/riskPolicy.js";

/* ======================================================
   HELPERS
====================================================== */
const generateOtp = () =>
  crypto.randomInt(100000, 999999).toString();

const send2FACode = async (user, otp) => {
  try {
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: "Your AfyaLink Security Code",
        html: emailTemplate("Security Code", `<h1>${otp}</h1>`),
      });
      return;
    }
    if (user.phone) {
      await sendSMS({
        to: user.phone,
        message: `Your AfyaLink security code is ${otp}`,
      });
    }
  } catch (_e) {
    // Do not break auth flow if delivery channel is temporarily unavailable.
  }
};

const persistRiskAssessment = async (user, risk) => {
  if (!user || !risk) return;
  try {
    await RiskAssessment.create({
      hospital: user.hospital || null,
      score: risk.score,
      level: risk.level,
      factors: risk.reasons || [],
      evaluatedAt: new Date(),
    });
  } catch {
    // Risk persistence should never block auth flow.
  }
};

const emailTemplate = (title, body) => `
  <div style="font-family:Arial;background:#f4f6f8;padding:30px">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:30px">
      <h2 style="color:#0a7cff">${title}</h2>
      <div style="color:#333;font-size:15px">${body}</div>
      <hr />
      <p style="font-size:12px;color:#777">
        AfyaLink HRMS • Secure Healthcare Systems
      </p>
    </div>
  </div>
`;

/* ======================================================
   REGISTER
====================================================== */
export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      nationalIdNumber,
      nationalIdCountry,
    } = req.body;

    if (!name || !password || (!email && !phone)) {
      return res
        .status(400)
        .json({ msg: "Name, password, and email or phone are required" });
    }

    if (email && (await User.findOne({ email }))) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    if (phone && (await User.findOne({ phone }))) {
      return res.status(400).json({ msg: "Phone already registered" });
    }

    const verificationDeadline = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    );

    const user = await User.create({
      name,
      email: email ? email.toLowerCase() : undefined,
      phone,
      password,
      role: "PATIENT",
      emailVerified: false,
      phoneVerified: false,
      verificationDeadline,
      verificationRemindersSent: [],
      nationalIdNumber,
      nationalIdCountry,
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_REGISTERED",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_REGISTERED",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { authProvider: user.authProvider || "local" },
    });

    if (email) {
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
      sendEmail({
        to: user.email,
        subject: "Verify your AfyaLink account",
        html: emailTemplate(
          "Verify Your Email",
          `<p>Click below to verify your account:</p>
           <a href="${verifyLink}">Verify Email</a>`
        ),
      }).catch(() => {});
    }

    if (phone) {
      const otp = generateOtp();
      await setOtp(`phone:${user._id}`, otp, 300);
      await sendSMS({
        to: phone,
        message: `Your AfyaLink verification code is ${otp}`,
      });
    }

    res.status(201).json({
      success: true,
      msg: "Registration successful",
      phoneOtpSent: Boolean(phone),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   VERIFY EMAIL
====================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ msg: "Invalid verification link" });
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();

      await AuditLog.create({
        actorId: user._id,
        actorRole: user.role,
        action: "EMAIL_VERIFIED",
        resource: "User",
        resourceId: user._id,
      });
      await appendComplianceLedger({
        actorId: user._id,
        actorRole: user.role,
        action: "EMAIL_VERIFIED",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital || null,
      });
    }

    res.json({ success: true });
  } catch {
    res.status(400).json({ msg: "Link expired or invalid" });
  }
};

/* ======================================================
   RESEND VERIFICATION EMAIL
====================================================== */
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        msg: "If the account exists, a verification email was sent.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({ msg: "Email already verified" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your AfyaLink account",
      html: emailTemplate(
        "Verify Your Email",
        `<p>Click below to verify your account:</p>
         <a href="${verifyLink}">Verify Email</a>`
      ),
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "VERIFICATION_EMAIL_RESENT",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "VERIFICATION_EMAIL_RESENT",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
    });

    res.json({ msg: "Verification email resent" });
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginId = email || phone || identifier;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email or phone and password are required",
      });
    }

    const query = loginId.includes("@")
      ? { email: loginId.toLowerCase() }
      : { phone: loginId };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        msg: "Invalid credentials",
      });
    }

    if (user.authProvider === "google") {
      return res.status(400).json({
        success: false,
        msg: "Please sign in using Google",
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        msg: "Invalid credentials",
      });
    }

    const policy = await getRiskPolicy();
    const risk = assessLoginRisk(req, user, policy);
    await persistRiskAssessment(user, risk);
    if (risk.level === "HIGH" || risk.level === "CRITICAL") {
      const otp = generateOtp();
      await redis.set(`2fa:${user._id}`, otp, { ex: 300 });
      await send2FACode(user, otp);

      if (risk.level === "CRITICAL") {
        const restrictionMinutes = Number(policy?.restrictionMinutes ?? 30);
        const restrictedUntil = new Date(Date.now() + restrictionMinutes * 60 * 1000);
        await redis.set(
          `risk:restricted:${String(user._id)}`,
          JSON.stringify({ reason: "CRITICAL_LOGIN_RISK", until: restrictedUntil.toISOString() }),
          { ex: restrictionMinutes * 60 }
        );
        user.sessionSecurity = {
          ...(user.sessionSecurity || {}),
          restrictedUntil,
        };
        await user.save();
      }

      await AuditLog.create({
        actorId: user._id,
        actorRole: user.role,
        action: "LOGIN_RISK_STEPUP_REQUIRED",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital || null,
        metadata: { score: risk.score, reasons: risk.reasons, ip: risk.ip },
        success: true,
      });
      await appendComplianceLedger({
        actorId: user._id,
        actorRole: user.role,
        action: "LOGIN_RISK_STEPUP_REQUIRED",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital || null,
        metadata: { score: risk.score, reasons: risk.reasons },
      });

      return res.json({
        success: true,
        requires2FA: true,
        reason: risk.level === "CRITICAL" ? "RISK_CRITICAL_RESTRICTED" : "RISK_STEP_UP",
        risk: { level: risk.level, score: risk.score, reasons: risk.reasons },
        userId: user._id,
      });
    }

    if (user.twoFactorEnabled) {
      const otp = generateOtp();
      await redis.set(`2fa:${user._id}`, otp, { ex: 300 });
      await send2FACode(user, otp);
      return res.json({
        success: true,
        requires2FA: true,
        reason: "ACCOUNT_2FA",
        userId: user._id,
      });
    }

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      twoFactorVerified: true,
      riskLevel: risk.level,
      riskScore: risk.score,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await upsertTrustedDevice(user, risk);
    user.sessionSecurity = {
      ...(user.sessionSecurity || {}),
      lastLoginAt: new Date(),
      lastLoginIp: risk.ip || "",
      lastLoginCountry: risk.country || "",
      lastRiskScore: risk.score,
      lastRiskLevel: risk.level,
      restrictedUntil: null,
    };
    await redis.del(`risk:restricted:${String(user._id)}`);
    await user.save();

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { riskLevel: risk.level, riskScore: risk.score },
      success: true,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { riskLevel: risk.level, riskScore: risk.score },
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        verificationDeadline: user.verificationDeadline,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      msg: "Login failed",
    });
  }
};

/* ======================================================
   LOGOUT
====================================================== */
export const logout = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, msg: "Not authenticated" });
    }

    const { refreshToken } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    } else {
      user.refreshTokens = [];
    }
    await user.save();

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGOUT",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGOUT",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
    });

    return res.json({ success: true, msg: "Logged out successfully" });
  } catch (err) {
    console.error("LOGOUT ERROR:", err);
    return res.status(500).json({ success: false, msg: "Logout failed" });
  }
};


/* ======================================================
   GOOGLE AUTH
====================================================== */
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ msg: "Missing Google credential" });
    }

    // Verify Google token
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    const payload = await response.json();

    if (!payload?.email) {
      return res.status(401).json({ msg: "Invalid Google token" });
    }

    let user = await User.findOne({ email: payload.email });

    // Create user if not exists
    if (!user) {
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email,
        password: crypto.randomBytes(16).toString("hex"),
        role: "PATIENT",
        emailVerified: true,
        authProvider: "google",
        emailVerifiedAt: new Date(),
      });

      await AuditLog.create({
        actorId: user._id,
        actorRole: user.role,
        action: "USER_REGISTERED_GOOGLE",
        resource: "User",
        resourceId: user._id,
      });
      await appendComplianceLedger({
        actorId: user._id,
        actorRole: user.role,
        action: "USER_REGISTERED_GOOGLE",
        resource: "User",
        resourceId: user._id,
        hospital: user.hospital || null,
        metadata: { authProvider: "google" },
      });
    }

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: true,
      phoneVerified: user.phoneVerified,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN_GOOGLE",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);
    res.status(500).json({ msg: "Google authentication failed" });
  }
};


/* ======================================================
   VERIFY 2FA OTP
====================================================== */
export const verify2FAOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const savedOtp = await redis.get(`2fa:${userId}`);

    if (!savedOtp || savedOtp !== otp) {
      return res.status(401).json({ msg: "Invalid or expired OTP" });
    }

    await redis.del(`2fa:${userId}`);

    const user = await User.findById(userId);
    const policy = await getRiskPolicy();
    const risk = assessLoginRisk(req, user, policy);

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phoneVerified: user.phoneVerified,
      twoFactorVerified: true,
      stepUpVerifiedAt: new Date().toISOString(),
      riskLevel: risk.level,
      riskScore: risk.score,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await redis.set(`stepup:last:${String(user._id)}`, new Date().toISOString(), { ex: 3600 });
    await redis.del(`risk:restricted:${String(user._id)}`);
    await upsertTrustedDevice(user, risk);
    user.sessionSecurity = {
      ...(user.sessionSecurity || {}),
      lastLoginAt: new Date(),
      lastLoginIp: risk.ip || "",
      lastLoginCountry: risk.country || "",
      lastRiskScore: risk.score,
      lastRiskLevel: risk.level,
      restrictedUntil: null,
    };
    await user.save();

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "2FA_VERIFIED",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "2FA_VERIFIED",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { riskLevel: risk.level, riskScore: risk.score },
    });

    res.json({ accessToken, refreshToken, user });
  } catch {
    res.status(500).json({ msg: "2FA verification failed" });
  }
};

/* ======================================================
   PHONE OTP REQUEST (AUTH)
====================================================== */
export const requestPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (phone) {
      if (await User.findOne({ phone, _id: { $ne: user._id } })) {
        return res.status(400).json({ msg: "Phone already in use" });
      }
      user.phone = phone;
      user.phoneVerified = false;
      await user.save();
    }

    if (!user.phone) {
      return res.status(400).json({ msg: "Phone number is required" });
    }

    const otp = generateOtp();
    await setOtp(`phone:${user._id}`, otp, 300);
    await sendSMS({
      to: user.phone,
      message: `Your AfyaLink verification code is ${otp}`,
    });

    res.json({ success: true, msg: "OTP sent" });
  } catch (err) {
    res.status(500).json({ msg: "Failed to send OTP" });
  }
};

/* ======================================================
   PHONE OTP VERIFY (AUTH)
====================================================== */
export const verifyPhoneOtp = async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ msg: "OTP is required" });

    const key = `phone:${req.user.id}`;
    const saved = await getOtp(key);
    if (!saved || saved !== otp) {
      return res.status(401).json({ msg: "Invalid or expired OTP" });
    }

    await delOtp(key);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.phoneVerified = true;
    user.phoneVerifiedAt = new Date();
    user.verificationDeadline = null;
    await user.save();

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "PHONE_VERIFIED",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "PHONE_VERIFIED",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: "Phone verification failed" });
  }
};

/* ======================================================
   RESEND 2FA
====================================================== */
export const resend2FA = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ msg: "2FA not enabled" });
    }

    const otp = generateOtp();
    await redis.set(`2fa:${user._id}`, otp, { ex: 300 });

    await sendEmail({
      to: user.email,
      subject: "Your AfyaLink Security Code",
      html: emailTemplate("Security Code", `<h1>${otp}</h1>`),
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "2FA_RESENT",
      resource: "User",
      resourceId: user._id,
    });
    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "2FA_RESENT",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
    });

    res.json({ msg: "2FA code resent" });
  } catch {
    res.status(500).json({ msg: "Failed to resend 2FA" });
  }
};

/* ======================================================
   STEP-UP AUTH (RISK-ADAPTIVE)
====================================================== */
export const requestStepUpOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const otp = generateOtp();
    await redis.set(`stepup:${user._id}`, otp, { ex: 300 });
    await send2FACode(user, otp);

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "STEPUP_OTP_SENT",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      success: true,
    });

    res.json({ success: true, msg: "Step-up code sent" });
  } catch (err) {
    console.error("STEPUP REQUEST ERROR:", err);
    res.status(500).json({ success: false, msg: "Step-up request failed" });
  }
};

export const verifyStepUpOtp = async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (!otp) return res.status(400).json({ msg: "OTP is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const key = `stepup:${user._id}`;
    const saved = await redis.get(key);
    if (!saved || saved !== String(otp)) {
      return res.status(401).json({ msg: "Invalid or expired OTP" });
    }
    await redis.del(key);

    const verifiedAt = new Date().toISOString();
    await redis.set(`stepup:last:${String(user._id)}`, verifiedAt, { ex: 3600 });
    await redis.del(`risk:restricted:${String(user._id)}`);

    const policy = await getRiskPolicy();
    const risk = assessLoginRisk(req, user, policy);
    user.sessionSecurity = {
      ...(user.sessionSecurity || {}),
      restrictedUntil: null,
      lastRiskScore: risk.score,
      lastRiskLevel: risk.level,
    };
    await user.save();
    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      twoFactorVerified: true,
      stepUpVerifiedAt: verifiedAt,
      riskLevel: risk.level,
      riskScore: risk.score,
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "STEPUP_VERIFIED",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { riskLevel: risk.level, riskScore: risk.score },
      success: true,
    });

    await appendComplianceLedger({
      actorId: user._id,
      actorRole: user.role,
      action: "STEPUP_VERIFIED",
      resource: "User",
      resourceId: user._id,
      hospital: user.hospital || null,
      metadata: { riskLevel: risk.level, riskScore: risk.score },
    });

    res.json({ success: true, accessToken, stepUpVerifiedAt: verifiedAt });
  } catch (err) {
    console.error("STEPUP VERIFY ERROR:", err);
    res.status(500).json({ success: false, msg: "Step-up verification failed" });
  }
};

export const getSessionRisk = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const policy = await getRiskPolicy();
    const risk = assessLoginRisk(req, user, policy);
    const stepUpRaw = await redis.get(`stepup:last:${String(user._id)}`);
    const restrictionRaw = await redis.get(`risk:restricted:${String(user._id)}`);
    const stepUpVerifiedAt = stepUpRaw || req.tokenPayload?.stepUpVerifiedAt || null;
    let restriction = null;
    if (restrictionRaw) {
      try {
        restriction = JSON.parse(restrictionRaw);
      } catch {
        restriction = { reason: "RISK_RESTRICTION_ACTIVE", until: null };
      }
    }

    res.json({
      success: true,
      risk: {
        level: risk.level,
        score: risk.score,
        reasons: risk.reasons,
        ip: risk.ip,
      },
      stepUpVerifiedAt,
      requiresStepUp: risk.level === "HIGH" || risk.level === "CRITICAL",
      restriction,
      policy: {
        thresholds: policy?.thresholds,
        impossibleTravelWindowMinutes: policy?.impossibleTravelWindowMinutes,
        restrictionMinutes: policy?.restrictionMinutes,
      },
    });
  } catch (err) {
    console.error("SESSION RISK ERROR:", err);
    res.status(500).json({ success: false, msg: "Failed to evaluate session risk" });
  }
};

/* ======================================================
   CHANGE PASSWORD
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");

    const match = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!match) {
      return res.status(400).json({ msg: "Wrong password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   ADMIN VERIFY USER
====================================================== */
export const adminVerifyUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ msg: "User already verified" });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: "ADMIN_EMAIL_VERIFIED",
      resource: "User",
      resourceId: user._id,
      metadata: { method: "ROLE_OVERRIDE" },
    });

    res.json({
      success: true,
      msg: "User email verified by admin",
    });
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};
