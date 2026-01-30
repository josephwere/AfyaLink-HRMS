// backend/controllers/googleAuthController.js

import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import AuditLog from "../models/AuditLog.js";

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
});

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ msg: "Missing Google credential" });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({ msg: "Invalid Google token" });
    }

    const {
      sub: googleId,
      email,
      name,
      email_verified,
      picture,
    } = payload;

    if (!email_verified) {
      return res.status(403).json({ msg: "Google email not verified" });
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        authProvider: "google",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        role: "PATIENT",
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();
    }

    // Generate JWT tokens
    const accessToken = signAccessToken({
      id: user._id,
      role: user.role,
      emailVerified: true,
      twoFactorVerified: true,
    });

    const refreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Audit log
    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "GOOGLE_LOGIN",
      resource: "User",
      resourceId: user._id,
    });

    return res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: true,
        authProvider: "google",
      },
    });
  } catch (err) {
    console.error("❌ Google login failed:", err.message);
    return res.status(401).json({ msg: "Invalid Google token" });
  }
};
