// backend/controllers/refreshController.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";

/* ======================================================
   REFRESH ACCESS TOKEN
====================================================== */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ msg: "Refresh token missing" });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
    } catch {
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    if (!user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ msg: "Refresh token revoked" });
    }

    /* 🔄 Rotate refresh token */
    user.refreshTokens = user.refreshTokens.filter(
      (t) => t !== refreshToken
    );

    const newRefreshToken = signRefreshToken({ id: user._id });
    user.refreshTokens.push(newRefreshToken);

    const accessToken = signAccessToken({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorVerified: true,
    });

    await user.save();

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ msg: "Failed to refresh token" });
  }
};
