// backend/controllers/googleAuthController.js
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import AuditLog from "../models/AuditLog.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ msg: "Missing Google credential" });

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, email, name, email_verified, picture } = ticket.getPayload();

    if (!email_verified) return res.status(403).json({ msg: "Google email not verified" });

    // Find existing user by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Create PATIENT only for completely new users
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: "google",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        role: "PATIENT", // default for new users
        avatar: picture,
      });
    } else if (!user.googleId) {
      // Link existing account to Google
      user.googleId = googleId;
      user.authProvider = "google";
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
      }
      await user.save();
    }

    // Generate JWT tokens
    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
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

    // Respond with token
    res.json({
      success: true,
      accessToken,
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        authProvider: "google",
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({ msg: "Invalid Google token" });
  }
};
