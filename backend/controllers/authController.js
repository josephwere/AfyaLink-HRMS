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

const RESEND_LIMIT = 60; // seconds (anti-spam)

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
   REGISTER (NO AUTO LOGIN)
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
        <p>Please verify your email to activate your account:</p>
        <a href="${verifyLink}"
           style="display:inline-block;padding:10px 20px;background:#0a7cff;color:#fff;border-radius:5px;text-decoration:none">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        `
      ),
    });

    res.status(201).json({
      success: true,
      msg: "Registration successful. Check your email to verify your account.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   VERIFY EMAIL
====================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ msg: "Invalid link" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ msg: "User not found" });

    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();

      /* 🧾 Audit log (safe) */
      try {
        await AuditLog.create({
          actorId: user._id,
          actorRole: "user",
          action: "EMAIL_VERIFIED",
          resource: "User",
          resourceId: user._id,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
      } catch {
        console.warn("Audit log failed: EMAIL_VERIFIED");
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ msg: "Verification link expired or invalid" });
  }
};

/* ======================================================
   RESEND VERIFICATION EMAIL (RATE LIMITED)
====================================================== */
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.emailVerified) {
      return res.status(400).json({ msg: "Email already verified" });
    }

    const key = `verify-resend:${user._id}`;
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      return res.status(429).json({
        msg: "Please wait before resending",
        retryAfter: ttl,
      });
    }

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
        <p>Please verify your email:</p>
        <a href="${verifyLink}"
           style="display:inline-block;padding:10px 20px;background:#0a7cff;color:#fff;border-radius:5px;text-decoration:none">
          Verify Email
        </a>
        <p>Link expires in 24 hours.</p>
        `
      ),
    });

    await redis.set(key, "1", { ex: RESEND_LIMIT });

    /* 🧾 Audit log */
    try {
      await AuditLog.create({
        actorId: user._id,
        actorRole: "user",
        action: "VERIFICATION_EMAIL_RESENT",
        resource: "User",
        resourceId: user._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {
      console.warn("Audit log failed: VERIFICATION_EMAIL_RESENT");
    }

    res.json({ msg: "Verification email resent", retryAfter: RESEND_LIMIT });
  } catch (err) {
    console.error("Resend error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   LOGIN (EMAIL VERIFIED + 2FA SAFE)
====================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    if (!user.emailVerified) {
      return res.status(403).json({
        requiresEmailVerification: true,
        msg: "Please verify your email before logging in",
      });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const deviceId = getDeviceId(req);
    const trusted = user.trustedDevices?.find(
      (d) => d.deviceId === deviceId
    );

    if (trusted && Date.now() - new Date(trusted.verifiedAt) < TRUSTED_DAYS) {
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
   ADMIN — MANUAL EMAIL VERIFICATION OVERRIDE
====================================================== */
export const adminVerifyUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.emailVerified) {
      return res.status(400).json({ msg: "User already verified" });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    /* 🧾 Audit log */
    try {
      await AuditLog.create({
        actorId: req.user.id,
        actorRole: "admin",
        action: "ADMIN_EMAIL_VERIFIED",
        resource: "User",
        resourceId: user._id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } catch {
      console.warn("Audit log failed: ADMIN_EMAIL_VERIFIED");
    }

    res.json({
      success: true,
      msg: "User email verified by admin",
    });
  } catch (err) {
    console.error("Admin verify error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
