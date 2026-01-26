import http from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import { Server as IOServer } from "socket.io";
import cors from "cors";   // ✅ add cors

import connectDB from "./config/db.js";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";

import seedSuperAdmin from "./seed/superAdmin.js";
import { cleanupExpiredBreakGlass } from "./workers/breakGlassCleanup.js";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import { cleanupExpiredEmergencyAccess } from "./workers/emergencyCleanup.js";import express from "express";
import { OAuth2Client } from "google-auth-library";
import User from "./models/User.js"; // adjust path to your User model

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();

// ✅ Google OAuth route
router.post("/api/auth/google", async (req, res) => {
  try {
    const { token } = req.body; // frontend should send { token: "id_token" }

    if (!token) {
      return res.status(400).json({ success: false, msg: "Missing Google token" });
    }

    // Verify the token against your client ID
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    // Find or create user in DB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        googleId: sub,
        email,
        name,
        avatar: picture,
      });
    }

    return res.json({
      success: true,
      msg: "Google login successful",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Google auth failed:", err);
    return res.status(500).json({ success: false, msg: "Google authentication failed" });
  }
});

// Mount the router
app.use(router);



dotenv.config();

const PORT = process.env.PORT || 5000;

/* ======================================================
   ⏰ CRON JOBS
====================================================== */
cron.schedule("0 0 * * *", cleanupUnverifiedUsers, { timezone: "Africa/Nairobi" });
cron.schedule("*/5 * * * *", cleanupExpiredBreakGlass, { timezone: "Africa/Nairobi" });
cron.schedule("*/5 * * * *", cleanupExpiredEmergencyAccess, { timezone: "Africa/Nairobi" });

/* ======================================================
   🌐 ALLOWED ORIGINS (HTTP + SOCKET.IO)
====================================================== */
const allowedOrigins = [
  process.env.FRONTEND_URL, // main frontend
  "https://afya-link-hrms-frontend-4.vercel.app",
  "https://afya-link-hrms-frontend-4.onrender.com", // ✅ add Render domain
  "http://localhost:3000" // ✅ allow local dev
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // mobile apps, curl, postman
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true; // preview deployments
  return false;
};

/* ======================================================
   🚀 SERVER START
====================================================== */
const start = async () => {
  try {
    await connectDB();
    await seedSuperAdmin();

    // ✅ Apply CORS middleware for HTTP requests
    app.use(cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`HTTP CORS blocked: ${origin}`));
        }
      },
      credentials: true
    }));

    // ✅ Fix Cross-Origin-Opener-Policy for Google OAuth popup
    app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });

    const server = http.createServer(app);

    const io = new IOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (isAllowedOrigin(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Socket.IO CORS blocked: ${origin}`));
          }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
      },
    });

    initSocket(io);

    server.listen(PORT, () => {
      console.log(`🚀 AfyaLink HRMS backend running on port ${PORT}`);
      console.log("🌍 Allowed origins:", allowedOrigins);
    });
  } catch (err) {
    console.error("❌ Server startup failed", err);
    process.exit(1);
  }
};

start();
