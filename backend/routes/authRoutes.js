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
  googleAuth,
} from "../controllers/authController.js";

import { refreshToken } from "../controllers/refreshController.js";

const router = express.Router();

/* =========================
   GOOGLE
========================= */
router.post("/google", googleAuth);

/* =========================
   AUTH
========================= */
router.post("/register", register);
router.post("/login", login);

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
  auth,
  requireRole("HOSPITAL_ADMIN", "SUPER_ADMIN"),
  adminVerifyUser
);

/* =========================
   PASSWORD
========================= */
router.post("/change-password", auth, changePassword);

/* =========================
   2FA
========================= */
router.post("/2fa/verify", verify2FAOtp);
router.post("/2fa/resend", resend2FA);

export default router;
