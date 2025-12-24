import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { redis } from "../utils/redis.js";
import { sendEmail } from "../utils/mailer.js";

/* ======================================================
   CONFIG
====================================================== */
const TRUSTED_DAYS =
  Number(process.env.TRUSTED_DEVICE_DAYS || 14) *
  24 *
  60 *
  60 *
  1000;

const RESEND_LIMIT = 60; // seconds

/* ======================================================
   HELPERS
====================================================== */
function getDeviceId(req) {
  const raw =
    req.headers["x-device-id"] ||
    req.headers["user-agent"] ||
    "unknown-device";

  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function emailTemplate(title, body) {
  return `
  <div style="font-family:Arial;background:#f4f6f8;padding:30px">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:30px">
      <h2 style="color:#0a7cff">${title}</h2>
      <div style="color:#333;font-size:15px">${body}</div>
      <hr />
      <p style="font-size:12px;color:#777">
        AfyaLink HRMS • Secure Healthcare Systems
      </p>
    </div>
  </div>`;
}

/* ======================================================
   REGISTER
====================================================== */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "user",
      emailVerified: false,
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Verify your AfyaLink account",
      html: emailTemplate(
        "Verify Your Email",
        `
        <p>Welcome to AfyaLink 👋</p>
        <p>Please verify your email:</p>
        <a href="${verifyLink}" style="padding:10px 20px;background:#0a7cff;color:#fff;border-radius:5px;text-decoration:none">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        `
      ),
    });

    res.status(201).json({
      success: true,
      msg: "Registration successful. Check your email.",
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
    if (!user) return res.status(400).json({ msg: "Invalid link" });

    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();

      await AuditLog.create({
        actorId: user._id,
        actorRole: "user",
        action: "EMAIL_VERIFIED",
        resource: "User",
        resourceId: user._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
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

    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.emailVerified)
      return res.status(400).json({ msg: "Already verified" });

    const key = `verify-resend:${user._id}`;
    const ttl = await redis.ttl(key);
    if (ttl > 0)
      return res.status(429).json({ retryAfter: ttl });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Verify your AfyaLink account",
      html: emailTemplate(
        "Verify Your Email",
        `<a href="${verifyLink}">Verify Email</a>`
      ),
    });

    await redis.set(key, "1", { ex: RESEND_LIMIT });

    await AuditLog.create({
      actorId: user._id,
      actorRole: "user",
      action: "VERIFICATION_EMAIL_RESENT",
      resource: "User",
      resourceId: user._id,
    });

    res.json({ msg: "Email resent", retryAfter: RESEND_LIMIT });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ msg: "Invalid credentials" });
    if (!user.emailVerified)
      return res.status(403).json({ requiresEmailVerification: true });

    if (!(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ msg: "Invalid credentials" });

    const deviceId = getDeviceId(req);

    if (user.twoFactorEnabled) {
      const otp = generateOtp();
      await redis.set(`2fa:${user._id}`, otp, { ex: 300 });

      await sendEmail({
        to: user.email,
        subject: "Your AfyaLink Security Code",
        html: emailTemplate("Security Code", `<h1>${otp}</h1>`),
      });

      return res.json({ requires2FA: true, userId: user._id });
    }

    const accessToken = signAccessToken({
      id: user._id,
      role: user.role,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({ accessToken, user });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
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

    const accessToken = signAccessToken({
      id: user._id,
      role: user.role,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "2FA_VERIFIED",
      resource: "User",
      resourceId: user._id,
    });

    res.json({ accessToken, user });
  } catch (err) {
    res.status(500).json({ msg: "2FA failed" });
  }
};

/* ======================================================
   RESEND 2FA
====================================================== */
export const resend2FA = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user || !user.twoFactorEnabled)
      return res.status(400).json({ msg: "2FA not enabled" });

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

    res.json({ msg: "2FA code resent" });
  } catch {
    res.status(500).json({ msg: "Failed to resend 2FA" });
  }
};

/* ======================================================
   CHANGE PASSWORD
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ msg: "Wrong password" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ msg: "Server error" });
  }
};
/* ======================================================
   ADMIN VERIFY USER (OVERRIDE)
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
      actorRole: "admin",
      action: "ADMIN_EMAIL_VERIFIED",
      resource: "User",
      resourceId: user._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: {
        method: "admin_override",
      },
    });

    res.json({
      success: true,
      msg: "User email verified by admin",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
