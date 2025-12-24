import User from "../models/User.js";
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

    if (await User.findOne({ email }))
      return res.status(400).json({ msg: "Email already registered" });

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
      to: user.email,
      subject: "Verify your AfyaLink account",
      html: emailTemplate(
        "Verify Your Email",
        `
        <p>Welcome to AfyaLink 👋</p>
        <p>Please verify your email to activate your account:</p>
        <a href="${verifyLink}" style="display:inline-block;padding:10px 20px;background:#0a7cff;color:#fff;border-radius:5px;text-decoration:none">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        `
      ),
    });

    res.status(201).json({
      msg: "Registration successful. Check email for verification.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   EMAIL VERIFICATION
====================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(400).json({ msg: "Invalid token" });

    user.emailVerified = true;
    await user.save();

    res.json({ msg: "Email verified successfully" });
  } catch {
    res.status(400).json({ msg: "Verification failed" });
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

    if (!user.emailVerified) {
      return res.json({
        requiresEmailVerification: true,
        email: user.email,
        userId: user._id,
      });
    }

    if (!(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ msg: "Invalid credentials" });

    const deviceId = getDeviceId(req);
    const trusted = user.trustedDevices?.find(
      (d) => d.deviceId === deviceId
    );

    if (trusted && Date.now() - new Date(trusted.verifiedAt) < TRUSTED_DAYS) {
      trusted.lastUsed = new Date();
      await user.save();

      const accessToken = signAccessToken({
        id: user._id,
        role: user.role,
        twoFactorVerified: true,
      });

      const refreshToken = signRefreshToken({ id: user._id });
      user.refreshTokens.push(refreshToken);
      await user.save();

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken, user });
    }

    if (user.twoFactorEnabled) {
      const otp = crypto.randomInt(100000, 999999).toString();
      await redis.set(`2fa:${user._id}`, otp, { ex: 300 });

      await sendEmail({
        to: user.email,
        subject: "AfyaLink Security Code",
        html: emailTemplate(
          "Security Verification",
          `<h1>${otp}</h1><p>Expires in 5 minutes.</p>`
        ),
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

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
/* ======================================================
   RESEND 2FA CODE
====================================================== */
export const resend2FA = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ msg: "2FA not enabled for this account" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await redis.set(`2fa:${user._id}`, otp, { ex: 300 }); // 5 minutes

    await sendEmail({
      to: user.email,
      subject: "Your AfyaLink Security Code",
      html: emailTemplate(
        "Security Verification",
        `<h1>${otp}</h1><p>Expires in 5 minutes.</p>`
      ),
    });

    res.json({ msg: "Verification code resent" });
  } catch (err) {
    console.error("Resend 2FA error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   PASSWORD RESET
====================================================== */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ msg: "If account exists, email sent" });

  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(`reset:${token}`, user._id.toString(), { ex: 3600 });

  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your AfyaLink password",
    html: emailTemplate(
      "Password Reset",
      `<a href="${link}">Reset Password</a><p>Valid for 1 hour.</p>`
    ),
  });

  res.json({ msg: "Password reset email sent" });
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  const userId = await redis.get(`reset:${token}`);
  if (!userId) return res.status(400).json({ msg: "Invalid token" });

  const user = await User.findById(userId);
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  await redis.del(`reset:${token}`);
  res.json({ msg: "Password reset successful" });
};
/* ======================================================
   CHANGE PASSWORD (AUTHENTICATED)
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id; // set by auth middleware
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    // Optional but recommended: invalidate old refresh tokens
    user.refreshTokens = [];
    await user.save();

    res.json({ msg: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   ADMIN ALERT (example)
====================================================== */
export const adminAlert = async (message) => {
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: "AfyaLink Admin Alert",
    html: emailTemplate("System Alert", `<p>${message}</p>`),
  });
};
