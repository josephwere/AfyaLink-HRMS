// backend/controllers/googleAuthController.js
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import AuditLog from "../models/AuditLog.js";
import { queueBrevoContactSync } from "../services/brevoContacts.js";
import { setRefreshTokenCookie } from "../utils/authCookies.js";
import { createSessionId, registerRefreshSession } from "../utils/authSessions.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_AUTH_TIMEOUT_SENTINEL = Symbol("GOOGLE_AUTH_TIMEOUT");
const GOOGLE_AUTH_TIMEOUT_MS = Math.max(
  Number(process.env.GOOGLE_AUTH_TIMEOUT_MS || 6000) || 6000,
  1000
);

const withGoogleAuthTimeout = async (step, operation, timeoutMs = GOOGLE_AUTH_TIMEOUT_MS) => {
  let timer;
  const result = await Promise.race([
    Promise.resolve().then(() => (typeof operation === "function" ? operation() : operation)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(GOOGLE_AUTH_TIMEOUT_SENTINEL), timeoutMs);
      timer.unref?.();
    }),
  ]);

  if (timer) clearTimeout(timer);

  if (result === GOOGLE_AUTH_TIMEOUT_SENTINEL) {
    const error = new Error(`${step} timed out`);
    error.code = "GOOGLE_AUTH_TIMEOUT";
    throw error;
  }

  return result;
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ msg: "Missing Google credential" });

    // Verify Google token
    const ticket = await withGoogleAuthTimeout("VERIFY_GOOGLE_TOKEN", () =>
      client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
    );

    const { sub: googleId, email, name, email_verified, picture } = ticket.getPayload();

    if (!email_verified) return res.status(403).json({ msg: "Google email not verified" });

    // Find existing user by googleId or email
    let user = await withGoogleAuthTimeout("GOOGLE_USER_LOOKUP", () =>
      User.findOne({ $or: [{ googleId }, { email }] }).maxTimeMS(5000).exec()
    );

    if (!user) {
      // Create PATIENT only for completely new users
      user = await withGoogleAuthTimeout("GOOGLE_USER_CREATE", () =>
        User.create({
          name,
          email,
          googleId,
          authProvider: "google",
          authMethods: ["google"],
          emailVerified: true,
          emailVerifiedAt: new Date(),
          role: "PATIENT", // default for new users
          avatar: picture,
        })
      );
      queueBrevoContactSync(user, { source: "GOOGLE_LOGIN_CONTROLLER_REGISTER" });
    } else if (!user.googleId) {
      // Link existing account to Google without losing existing local login.
      if (!Array.isArray(user.authMethods)) {
        user.authMethods = user.authProvider ? [user.authProvider] : [];
      }
      if (!user.authMethods.includes("google")) {
        user.authMethods.push("google");
      }
      user.googleId = googleId;
      if (!user.authProvider) {
        user.authProvider = user.authMethods.includes("local") ? "local" : "google";
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
      }
      await withGoogleAuthTimeout("GOOGLE_USER_LINK_SAVE", () => user.save());
    }

    if (user.active === false) {
      return res.status(403).json({ msg: "This account is deactivated. Contact support or your administrator." });
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

    const sessionStartedAt = new Date().toISOString();
    const sessionId = createSessionId();
    const refreshToken = signRefreshToken({ id: user._id, sessionStartedAt, sessionId });
    registerRefreshSession(user, {
      refreshToken,
      sessionId,
      startedAt: sessionStartedAt,
      req,
      source: "GOOGLE_LOGIN",
    });
    await withGoogleAuthTimeout("GOOGLE_SESSION_SAVE", () => user.save());

    // Audit log
    await withGoogleAuthTimeout("GOOGLE_AUDIT_LOG", () =>
      AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "GOOGLE_LOGIN",
      resource: "User",
      resourceId: user._id,
      })
    );

    setRefreshTokenCookie(res, refreshToken);
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
        authProvider: user.authProvider || "local",
        authMethods: Array.isArray(user.authMethods)
          ? user.authMethods
          : [user.authProvider || "local"],
      },
    });
  } catch (err) {
    if (err?.code === "GOOGLE_AUTH_TIMEOUT") {
      console.error("Google login timeout:", err.message);
      return res.status(503).json({ msg: "Google sign-in is temporarily unavailable. Please retry." });
    }

    // Log specific failure reason for debugging (server logs only)
    const failureReason = err?.message || String(err);
    let diagnosticDetail = "unknown_error";

    if (failureReason.includes("audience")) {
      diagnosticDetail = "audience_mismatch";
    } else if (failureReason.includes("signature")) {
      diagnosticDetail = "invalid_signature";
    } else if (failureReason.includes("expired")) {
      diagnosticDetail = "token_expired";
    } else if (failureReason.includes("malformed")) {
      diagnosticDetail = "malformed_token";
    } else if (failureReason.includes("email_verified")) {
      diagnosticDetail = "unverified_email";
    }

    console.error("[GOOGLE_AUTH_VERIFICATION_FAILED]", {
      failureReason: diagnosticDetail,
      errorMessage: failureReason,
      googleClientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
      timestamp: new Date().toISOString(),
    });

    // Generic client-facing message for security
    res.status(401).json({ msg: "Invalid Google token" });
  }
};
