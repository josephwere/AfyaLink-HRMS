import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import User from "../models/User.js";
import { redis } from "../utils/redis.js";
import { sendEmail } from "../utils/mailer.js";

import auth from "../middleware/auth.js";
import {
  login,
  verify2FAOtp,
  resend2FA,
  changePassword,
} from "../controllers/authController.js";

const router = express.Router();

/* ======================================================
   REGISTER (EMAIL VERIFICATION)
====================================================== */
router.post("/register", async (req, res) => {
  try {
    const { name, fullName, email, password } = req.body;
    const finalName = name || fullName;

    if (!finalName || !email || !password) {
      return res.status(400).json({ msg: "Missing fields" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ msg: "Email already in use" });
    }

    const user = await User.create({
      name: finalName,
      email,
      password,
      role: "PATIENT",
      emailVerified: false,
    });

    const token = crypto.randomBytes(32).toString("hex");

    await redis.set(`verify:${token}`, user._id.toString(), {
      ex: 60 * 60 * 24,
    });

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Verify your AfyaLink account",
      html: `
        <h2>Welcome to AfyaLink</h2>
        <p>Please verify your email:</p>
        <a href="${verifyLink}">${verifyLink}</a>
      `,
    });

    res.status(201).json({
      msg: "Registration successful. Check your email to verify your account.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ======================================================
   RESEND VERIFICATION EMAIL
====================================================== */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });
    if (user.emailVerified)
      return res.status(400).json({ msg: "Email already verified" });

    const token = crypto.randomBytes(32).toString("hex");

    await redis.set(`verify:${token}`, user._id.toString(), {
      ex: 60 * 60 * 24,
    });

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Verify your AfyaLink account",
      html: `<a href="${verifyLink}">${verifyLink}</a>`,
    });

    res.json({ msg: "Verification email resent" });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ======================================================
   VERIFY EMAIL
====================================================== */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send("Invalid link");

    const userId = await redis.get(`verify:${token}`);
    if (!userId) return res.status(400).send("Link expired");

    await User.findByIdAndUpdate(userId, { emailVerified: true });
    await redis.del(`verify:${token}`);

    res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
  } catch (err) {
    console.error("Verify email error:", err);
    res.status(500).send("Server error");
  }
});

/* ======================================================
   FORGOT PASSWORD
====================================================== */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.json({ msg: "If the email exists, a reset link was sent" });

    const token = crypto.randomBytes(32).toString("hex");

    await redis.set(`reset:${token}`, user._id.toString(), {
      ex: 60 * 15,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Reset your AfyaLink password",
      html: `<a href="${resetLink}">${resetLink}</a>`,
    });

    res.json({ msg: "If the email exists, a reset link was sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ======================================================
   RESET PASSWORD
====================================================== */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ msg: "Invalid request" });

    const userId = await redis.get(`reset:${token}`);
    if (!userId) return res.status(400).json({ msg: "Token expired" });

    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ msg: "User not found" });

    user.password = password;
    await user.save();
    await redis.del(`reset:${token}`);

    res.json({ msg: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ======================================================
   CHANGE PASSWORD (AUTH)
====================================================== */
router.post("/change-password", auth, changePassword);

/* ======================================================
   LOGIN
====================================================== */
router.post("/login", login);

/* ======================================================
   2FA
====================================================== */
router.post("/2fa/verify", verify2FAOtp);
router.post("/2fa/resend", resend2FA);

/* ======================================================
   REFRESH TOKEN
====================================================== */
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ msg: "No refresh token" });

    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(token))
      return res.status(401).json({ msg: "Token revoked" });

    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);

    const newRefresh = jwt.sign(
      { id: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "14d" }
    );

    user.refreshTokens.push(newRefresh);
    await user.save();

    res.cookie("refreshToken", newRefresh, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: jwt.sign(
        { id: user._id, role: user.role, twoFactorVerified: true },
        process.env.ACCESS_SECRET,
        { expiresIn: "15m" }
      ),
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

/* ======================================================
   LOGOUT
====================================================== */
router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      const decoded = jwt.decode(token);
      const user = await User.findById(decoded?.id);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
        await user.save();
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.json({ msg: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
