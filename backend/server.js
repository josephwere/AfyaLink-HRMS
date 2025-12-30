import http from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import { Server as IOServer } from "socket.io";

import connectDB from "./config/db.js";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";
import { cleanupExpiredBreakGlass } from "./workers/breakGlassCleanup.js";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import seedSuperAdmin from "./seed/superAdmin.js";
import { cleanupExpiredEmergencyAccess } from "./workers/emergencyCleanup.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

/* ======================================================
   VERIFICATION CLEANUP CRON (DAILY @ MIDNIGHT)
====================================================== */
cron.schedule(
  "0 0 * * *", // every day at 00:00
  async () => {
    console.log("⏰ Running daily verification cleanup job...");
    await cleanupUnverifiedUsers();
  },
  {
    timezone: "Africa/Nairobi",
  }
);
/* ======================================================
   🚨 BREAK-GLASS AUTO-EXPIRY (EVERY 5 MINUTES)
====================================================== */
cron.schedule(
  "*/5 * * * *", // every 5 minutes
  async () => {
    await cleanupExpiredBreakGlass();
  },
  {
    timezone: "Africa/Nairobi",
  }
);
/* ======================================================
   EmergencyCleanup
====================================================== */

cron.schedule(
  "*/5 * * * *",
  async () => {
    await cleanupExpiredEmergencyAccess();
  },
  { timezone: "Africa/Nairobi" }
);
/* ======================================================
   SAFE SOCKET.IO CORS (MATCHES EXPRESS)
====================================================== */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://afya-link-hrms-frontend-4.vercel.app",
].filter(Boolean);

/* ======================================================
   SERVER START
====================================================== */
const start = async () => {
  try {
    // 🔌 Connect MongoDB
    await connectDB();

    // 🌱 Seed SUPER_ADMIN (idempotent — safe to run every start)
    await seedSuperAdmin();

    // 🌐 Create HTTP server
    const server = http.createServer(app);

    // 🔗 Socket.IO server
    const io = new IOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Socket.IO CORS blocked: ${origin}`));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
      },
    });

    // 🔄 Initialize sockets
    initSocket(io);

    // 🚀 Start server
    server.listen(PORT, () => {
      console.log(`\n🚀 AfyaLink HRMS backend running on port ${PORT}`);
      console.log(`🌐 Allowed Origins:`, allowedOrigins, "\n");
    });
  } catch (err) {
    console.error("❌ Failed to start server", err);
    process.exit(1);
  }
};

start();
