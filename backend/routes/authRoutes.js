import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { serializeUser } from "../utils/serializers.js";

import {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  resend2FA,
  verify2FAOtp,
  changePassword,
  forgotPassword,
  requestPasswordResetPhoneOtp,
  resetPassword,
  resetPasswordWithPhoneOtp,
  logout,
  adminVerifyUser,
  requestPhoneOtp,
  verifyPhoneOtp,
  requestStepUpOtp,
  verifyStepUpOtp,
  getSessionRisk,
} from "../controllers/authController.js";

import { googleLogin } from "../controllers/googleAuthController.js";
import { refreshToken } from "../controllers/refreshController.js";
import { authSensitiveLimiter } from "../middleware/trafficGuards.js";
import { getUserCapabilities, getAllCapabilities } from "../controllers/capabilityController.js";

const router = express.Router();

/* =========================
   GOOGLE
========================= */
router.post("/google", authSensitiveLimiter, googleLogin);

/* =========================
   AUTH
========================= */
router.post("/register", authSensitiveLimiter, register);
router.post("/login", authSensitiveLimiter, login);
router.post("/logout", protect, logout);
router.post("/forgot-password", authSensitiveLimiter, forgotPassword);
router.post("/forgot-password/phone/request-otp", authSensitiveLimiter, requestPasswordResetPhoneOtp);
router.post("/reset-password", authSensitiveLimiter, resetPassword);
router.post("/reset-password/phone", authSensitiveLimiter, resetPasswordWithPhoneOtp);

/* =========================
   CURRENT USER (BOOTSTRAP)
========================= */
router.get("/me", protect, (req, res) => {
  res.json(serializeUser(req.user));
});

/* =========================
   TOKEN REFRESH
========================= */
router.post("/refresh", refreshToken);

/* =========================
   EMAIL VERIFICATION
========================= */
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", authSensitiveLimiter, resendVerificationEmail);

/* =========================
   ADMIN OVERRIDE
========================= */
router.post(
  "/admin/verify-user/:userId",
  protect,
  requireRole("HOSPITAL_ADMIN", "SUPER_ADMIN"),
  adminVerifyUser
);

/* =========================
   PASSWORD
========================= */
router.post("/change-password", protect, changePassword);

/* =========================
   2FA
========================= */
router.post("/2fa/verify", authSensitiveLimiter, verify2FAOtp);
router.post("/2fa/resend", authSensitiveLimiter, resend2FA);

/* =========================
   SESSION RISK + STEP-UP
========================= */
router.get("/session-risk", protect, getSessionRisk);
router.post("/step-up/request", protect, authSensitiveLimiter, requestStepUpOtp);
router.post("/step-up/verify", protect, authSensitiveLimiter, verifyStepUpOtp);

/* =========================
   PHONE VERIFICATION
========================= */
router.post("/phone/request-otp", protect, authSensitiveLimiter, requestPhoneOtp);
router.post("/phone/verify", protect, authSensitiveLimiter, verifyPhoneOtp);

/* =========================
   CAPABILITIES
========================= */
router.get("/capabilities", protect, getUserCapabilities);
router.get("/capabilities/all", protect, getAllCapabilities);

export default router;
