import http from "http";
import dotenv from "dotenv";
import cron from "node-cron";
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
   ⏰ CRON JOBS
====================================================== */

// Unverified users cleanup (daily)
cron.schedule(
  "0 0 * * *",
  cleanupUnverifiedUsers,
  { timezone: "Africa/Nairobi" }
);

// Break-glass auto expiry (every 5 min)
cron.schedule(
  "*/5 * * * *",
  cleanupExpiredBreakGlass,
  { timezone: "Africa/Nairobi" }
);

// Emergency access auto expiry (every 5 min)
cron.schedule(
  "*/5 * * * *",
  cleanupExpiredEmergencyAccess,
  { timezone: "Africa/Nairobi" }
);

/* ======================================================
   🌐 ALLOWED ORIGINS (HTTP + SOCKET.IO)
====================================================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,                // main frontend
  "https://afya-link-hrms-frontend-4.vercel.app",
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
