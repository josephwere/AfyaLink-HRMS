import express from "express";
import auth from "../middleware/auth.js";

import {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  resend2FA,
  verify2FAOtp,
  changePassword,
} from "../controllers/authController.js";

const router = express.Router();

/* ======================================================
   AUTH
====================================================== */
router.post("/register", register);
router.post("/login", login);

/* ======================================================
   EMAIL VERIFICATION
====================================================== */
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

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
