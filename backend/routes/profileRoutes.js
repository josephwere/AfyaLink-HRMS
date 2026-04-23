// routes/profileRoutes.js
import express from "express";
import {
  getProfile, 
  getFamilyMonitoring,
  getFamilyTimeline,
  searchMinorProfiles,
  linkMinorProfile,
  unlinkMinorProfile,
  exportMyData,
  deleteMyAccount,
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
router.get("/export", protect, exportMyData);
router.get("/family", protect, getFamilyMonitoring);
router.get("/family/timeline", protect, getFamilyTimeline);
router.get("/family/search", protect, searchMinorProfiles);
router.post("/family/minors/link", protect, linkMinorProfile);
router.delete("/family/minors/:patientId", protect, unlinkMinorProfile);
router.put("/", protect, updateProfile);
router.post("/delete-account", protect, deleteMyAccount);

// 2FA
router.post("/2fa/enable", protect, enable2FA);
router.post("/2fa/disable", protect, disable2FA);

// Password
router.post("/password", protect, changePassword);

// Security
router.put("/security", protect, updateSecuritySettings);

export default router;
