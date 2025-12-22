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
import auth from "../middleware/auth.js";

const router = express.Router();

// Profile
router.get("/", auth, getProfile);
router.put("/", auth, updateProfile);

// 2FA
router.post("/2fa/enable", auth, enable2FA);
router.post("/2fa/disable", auth, disable2FA);

// Password
router.post("/password", auth, changePassword);

// Security
router.put("/security", auth, updateSecuritySettings);

export default router;
