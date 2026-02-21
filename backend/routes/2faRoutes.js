import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/* ================================
   GET 2FA STATUS
================================ */
router.get("/status", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("twoFactorEnabled");

  if (!user) {
    return res.status(404).json({ msg: "User not found" });
  }

  res.json({ enabled: Boolean(user.twoFactorEnabled) });
});

/* ================================
   TOGGLE 2FA
================================ */
router.post("/toggle", protect, async (req, res) => {
  const { enabled } = req.body;

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ msg: "User not found" });
  }

  user.twoFactorEnabled = Boolean(enabled);
  await user.save();

  res.json({ enabled: user.twoFactorEnabled });
});

export default router;
