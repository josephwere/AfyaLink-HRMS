import http from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import cors from "cors";
import { Server as IOServer } from "socket.io";

import connectDB from "./config/db.js";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";

import seedSuperAdmin from "./seed/superAdmin.js";
import { cleanupExpiredBreakGlass } from "./workers/breakGlassCleanup.js";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import { cleanupExpiredEmergencyAccess } from "./workers/emergencyCleanup.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

/* ======================================================
   🌐 ALLOWED ORIGINS
====================================================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://afya-link-hrms-frontend-4.vercel.app",
  "https://afya-link-hrms-frontend-4.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173", // ✅ Vite FIX
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  return false;
};

/* ======================================================
   🚀 SERVER START
====================================================== */
const start = async () => {
  try {
    await connectDB();
    await seedSuperAdmin();

    // ✅ CORS MUST BE FIRST
    app.use(
      cors({
        origin: (origin, callback) => {
          if (isAllowedOrigin(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked: ${origin}`));
          }
        },
        credentials: true,
      })
    );

    // ✅ Required for Google OAuth popup
    app.use((req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });

    /* ======================================================
       ⏰ CRON JOBS
    ====================================================== */
    cron.schedule("0 0 * * *", cleanupUnverifiedUsers, { timezone: "Africa/Nairobi" });
    cron.schedule("*/5 * * * *", cleanupExpiredBreakGlass, { timezone: "Africa/Nairobi" });
    cron.schedule("*/5 * * * *", cleanupExpiredEmergencyAccess, { timezone: "Africa/Nairobi" });

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
