import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

import {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  resend2FA,
  verify2FAOtp,
  changePassword,
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

const router = express.Router();

/* =========================
   GOOGLE
========================= */
router.post("/google", googleLogin);

/* =========================
   AUTH
========================= */
router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);

/* =========================
   CURRENT USER (BOOTSTRAP)
========================= */
router.get("/me", protect, (req, res) => {
  res.json(req.user);
});

/* =========================
   TOKEN REFRESH
========================= */
router.post("/refresh", refreshToken);

/* =========================
   EMAIL VERIFICATION
========================= */
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

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
router.post("/2fa/verify", verify2FAOtp);
router.post("/2fa/resend", resend2FA);

/* =========================
   SESSION RISK + STEP-UP
========================= */
router.get("/session-risk", protect, getSessionRisk);
router.post("/step-up/request", protect, requestStepUpOtp);
router.post("/step-up/verify", protect, verifyStepUpOtp);

/* =========================
   PHONE VERIFICATION
========================= */
router.post("/phone/request-otp", protect, requestPhoneOtp);
router.post("/phone/verify", protect, verifyPhoneOtp);

export default router;
