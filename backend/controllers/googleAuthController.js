import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import AuditLog from "../models/AuditLog.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ msg: "Missing Google credential" });
    }

    // 🔐 Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const {
      sub: googleId,
      email,
      name,
      picture,
      email_verified,
    } = payload;

    if (!email_verified) {
      return res
        .status(403)
        .json({ msg: "Google email not verified" });
    }

    // 🔎 Find user
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    // 🆕 Create if not exists
    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: "google",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        role: "PATIENT",
      });
    } else {
      // 🔁 Link existing account safely
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "google";
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();
      }
    }

    // 🎟️ Tokens
    const accessToken = signAccessToken({
      id: user._id,
      role: user.role,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    // 🧾 Audit
    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "GOOGLE_LOGIN",
      resource: "User",
      resourceId: user._id,
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true,
        authProvider: "google",
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({
      success: false,
      msg: "Google authentication failed",
    });
  }
};
