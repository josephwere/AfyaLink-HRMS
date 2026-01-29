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

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub, email, name, email_verified } = ticket.getPayload();

    if (!email_verified) {
      return res.status(403).json({
        msg: "Google email not verified",
      });
    }

    // Find user by googleId or email
    let user = await User.findOne({
      $or: [{ googleId: sub }, { email }],
    });

    // If user doesn't exist, create without password
    if (!user) {
      user = new User({
        name,
        email,
        googleId: sub,
        authProvider: "google",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        role: "PATIENT",
      });

      // Temporarily disable password validation
      userSchemaPasswordOptional(user);

      await user.save();
    } else if (!user.googleId) {
      user.googleId = sub;
      user.authProvider = "google";
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      await user.save();
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

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "GOOGLE_LOGIN",
      resource: "User",
      resourceId: user._id,
    });

    res.json({
      success: true,
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
      msg: "Google authentication failed",
    });
  }
};

/* ======================================================
   Helper: skip password validation for Google users
====================================================== */
function userSchemaPasswordOptional(user) {
  user.validate = async function () {
    this.$isNew = true; // trick Mongoose to treat as new
    // Temporarily mark password as not required
    const schemaPassword = this.schema.paths.password;
    const origRequired = schemaPassword.options.required;
    schemaPassword.options.required = false;

    try {
      await this.validateSync();
    } finally {
      schemaPassword.options.required = origRequired;
    }
  };
}
