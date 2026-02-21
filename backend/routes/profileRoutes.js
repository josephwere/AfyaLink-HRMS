// routes/profileRoutes.js
import express from "express";
import { 
  getProfile, 
  updateProfile, 
  enable2FA, 
  disable2FA, 
  changePassword, 
  updateSecuritySettings 
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Profile
router.get("/", protect, getProfile);
router.put("/", protect, updateProfile);

// 2FA
router.post("/2fa/enable", protect, enable2FA);
router.post("/2fa/disable", protect, disable2FA);

// Password
router.post("/password", protect, changePassword);

// Security
router.put("/security", protect, updateSecuritySettings);

export default router;
