import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
   HELPERS — TRUSTED DEVICE
====================================================== */
function getDeviceId(req) {
  const raw =
    req.headers["x-device-id"] ||
    req.headers["user-agent"] ||
    "unknown-device";

  return crypto.createHash("sha256").update(raw).digest("hex");
}

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });
    if (!user.emailVerified)
      return res.status(403).json({ msg: "Please verify your email first" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ msg: "Invalid credentials" });

    const deviceId = getDeviceId(req);
    const trusted = user.trustedDevices?.find(
      (d) => d.deviceId === deviceId
    );

    if (trusted) {
      const expired =
        !trusted.verifiedAt ||
        Date.now() - new Date(trusted.verifiedAt).getTime() >
          TRUSTED_DAYS;

      if (!expired) {
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

        return res.json({
          accessToken,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      }
    }

    if (user.twoFactorEnabled) {
      const otp = crypto.randomInt(100000, 999999).toString();
      await redis.set(`2fa:${user._id}`, otp, { ex: 300 });

      await sendEmail({
        to: user.email,
        subject: "Your AfyaLink security code",
        html: `
          <h2>Security Verification</h2>
          <p>Your one-time code:</p>
          <h1>${otp}</h1>
          <p>Expires in 5 minutes.</p>
        `,
      });

      return res.json({
        requires2FA: true,
        userId: user._id,
        msg: "OTP sent",
      });
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

    res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   VERIFY 2FA OTP (FIXED)
====================================================== */
export const verify2FAOtp = async (req, res) => {
  try {
    const { userId, otp, rememberDevice } = req.body;

    const attemptKey = `2fa:attempts:${userId}`;
    const attempts = await redis.incr(attemptKey);

    if (attempts === 1) await redis.expire(attemptKey, 600);
    if (attempts > 5)
      return res.status(429).json({ msg: "Too many invalid attempts" });

    const storedOtp = await redis.get(`2fa:${userId}`);
    if (!storedOtp || storedOtp !== otp)
      return res.status(400).json({ msg: "Invalid or expired OTP" });

    await redis.del(`2fa:${userId}`);
    await redis.del(attemptKey);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (rememberDevice) {
      const deviceId = getDeviceId(req);
      const device = user.trustedDevices.find(
        (d) => d.deviceId === deviceId
      );

      if (device) {
        device.lastUsed = new Date();
        device.verifiedAt = new Date();
      } else {
        user.trustedDevices.push({
          deviceId,
          userAgent: req.headers["user-agent"],
          lastUsed: new Date(),
          verifiedAt: new Date(),
        });
      }
      await user.save();
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

    res.json({
      accessToken,
      msg: "2FA verified",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Verify 2FA error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   RESEND OTP
====================================================== */
export const resend2FA = async (req, res) => {
  try {
    const { userId } = req.body;

    const key = `2fa:resend:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) await redis.expire(key, 600);
    if (count > 3)
      return res.status(429).json({ msg: "Too many OTP requests" });

    const otp = crypto.randomInt(100000, 999999).toString();
    await redis.set(`2fa:${userId}`, otp, { ex: 300 });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    await sendEmail({
      to: user.email,
      subject: "Your AfyaLink security code",
      html: `<h2>Security Verification</h2><h1>${otp}</h1>`,
    });

    res.json({ msg: "OTP resent" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ======================================================
   CHANGE PASSWORD (FIXED)
====================================================== */
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Old password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
