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
   REGISTER (NO AUTO-LOGIN)
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

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   VERIFY EMAIL (REDIRECT)
====================================================== */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/verify-failed`);
    }

    if (!user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }

    return res.redirect(`${process.env.FRONTEND_URL}/verify-success`);
  } catch (err) {
    return res.redirect(`${process.env.FRONTEND_URL}/verify-failed`);
  }
};

/* ======================================================
   RESEND VERIFICATION EMAIL
====================================================== */
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
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
        `
        <p>Please verify your email to continue:</p>
        <a href="${verifyLink}" style="display:inline-block;padding:10px 20px;background:#0a7cff;color:#fff;border-radius:5px;text-decoration:none">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        `
      ),
    });

    res.json({ msg: "Verification email resent successfully" });
  } catch (err) {
    console.error("Resend verification error:", err);
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
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
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
