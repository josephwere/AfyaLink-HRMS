import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  disable2FASetting,
  get2FAStatus,
  regenerateRecoveryCodes,
  setupTOTP,
  toggle2FA,
  verifyTOTPSetup,
} from "../controllers/twoFactorController.js";

const router = express.Router();

router.get("/status", protect, get2FAStatus);
router.post("/toggle", protect, toggle2FA);
router.post("/setup-totp", protect, setupTOTP);
router.post("/verify-totp", protect, verifyTOTPSetup);
router.post("/recovery-codes/regenerate", protect, regenerateRecoveryCodes);
router.post("/disable", protect, disable2FASetting);

export default router;
