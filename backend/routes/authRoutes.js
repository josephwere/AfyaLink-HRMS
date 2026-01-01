import express from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

import {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  resend2FA,
  verify2FAOtp,
  changePassword,
  adminVerifyUser,
} from "../controllers/authController.js";

import { refreshToken } from "../controllers/refreshController.js";
import { googleLogin } from "../controllers/googleAuthController.js";

const router = express.Router();

/* =========================
   GOOGLE
========================= */
router.post("/google", googleLogin);

/* ======================================================
   AUTH
====================================================== */
router.post("/register", register);
router.post("/login", login);

/* ======================================================
   TOKEN REFRESH  ✅ FIX
====================================================== */
router.post("/refresh", refreshToken);

/* ======================================================
   EMAIL VERIFICATION
====================================================== */
router.get("/verify-email", verifyEmail);

// 🔔 USER-INITIATED VERIFICATION
router.post("/send-verification", auth, resendVerificationEmail);

// ♻️ PUBLIC RESEND
router.post("/resend-verification", resendVerificationEmail);

/* ======================================================
   ADMIN OVERRIDE
====================================================== */
router.post(
  "/admin/verify-user/:userId",
  auth,
  requireRole("admin"),
  adminVerifyUser
);

/* ======================================================
   PASSWORD
====================================================== */
router.post("/change-password", auth, changePassword);

/* ======================================================
   2FA
====================================================== */
router.post("/2fa/verify", verify2FAOtp);
router.post("/2fa/resend", resend2FA);

export default router;
