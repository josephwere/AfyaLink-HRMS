// backend/controllers/authController.js

import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { redis } from "../utils/redis.js";
import { sendEmail } from "../utils/mailer.js";

/* ======================================================
   HELPERS
====================================================== */
const generateOtp = () =>
  crypto.randomInt(100000, 999999).toString();

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
    const { name, email, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    const verificationDeadline = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    );

    const user = await User.create({
      name,
      email,
      password,
      role: "PATIENT",
      emailVerified: false,
      verificationDeadline,
      verificationRemindersSent: [],
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_REGISTERED",
      resource: "User",
      resourceId: user._id,
    });

    res.status(201).json({
      success: true,
      msg: "Registration successful",
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

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

    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        requires2FA: true,
        userId: user._id,
      });
    }

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
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
    }

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: true,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({
      success: true,
      accessToken,
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

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
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
  } catch {
    res.status(500).json({ msg: "2FA verification failed" });
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
