import http from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import cors from "cors";
import { Server as IOServer } from "socket.io";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import { validateRuntimeEnv } from "./config/validateEnv.js";
import app from "./app.js";
import { initSocket } from "./utils/socket.js";

import seedSuperAdmin from "./seed/superAdmin.js";
import { cleanupExpiredBreakGlass } from "./workers/breakGlassCleanup.js";
import { cleanupUnverifiedUsers } from "./workers/verificationCleanup.js";
import { cleanupExpiredEmergencyAccess } from "./workers/emergencyCleanup.js";
import { runWorkforceAutomationSweep } from "./workers/workforceAutomationSweep.js";
import { runSubscriptionLifecycleSweep } from "./workers/subscriptionLifecycleWorker.js";
import { runTrainingOverdueSweep } from "./workers/trainingOverdueWorker.js";
import { runAiAssistantBootstrap } from "./utils/aiAssistantBootstrap.js";
import { deliverDailyRoleQuotes } from "./services/dailyRoleQuoteService.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
let httpServer;
let ioServer;
let shuttingDown = false;

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
  try {
    const parsed = new URL(origin);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
  } catch {
    // ignore invalid origin string and continue with explicit checks
  }
  if (origin.endsWith(".vercel.app")) return true;
  return false;
};

/* ======================================================
   🚀 SERVER START
====================================================== */
const start = async () => {
  try {
    const envCheck = validateRuntimeEnv();
    if (!envCheck.ok) {
      console.error("❌ Production env validation failed:");
      for (const err of envCheck.errors) console.error(` - ${err}`);
      process.exit(1);
    }
    for (const warn of envCheck.warnings) {
      console.warn(`⚠️ ${warn}`);
    }

    await connectDB();
    await seedSuperAdmin();
    await runAiAssistantBootstrap();

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
    cron.schedule("*/10 * * * *", async () => {
      try {
        const result = await runWorkforceAutomationSweep();
        if (result.escalated > 0) {
          console.log(
            `[WORKFORCE_SWEEP] escalated=${result.escalated} scannedPolicies=${result.scannedPolicies}`
          );
        }
      } catch (err) {
        console.error("[WORKFORCE_SWEEP] failed", err);
      }
    }, { timezone: "Africa/Nairobi" });
    cron.schedule("0 * * * *", async () => {
      try {
        const result = await runSubscriptionLifecycleSweep();
        if (result.updated > 0) {
          console.log(`[SUBSCRIPTION_SWEEP] scanned=${result.scanned} updated=${result.updated}`);
        }
      } catch (err) {
        console.error("[SUBSCRIPTION_SWEEP] failed", err);
      }
    }, { timezone: "Africa/Nairobi" });
    cron.schedule("15 */3 * * *", async () => {
      try {
        const result = await runTrainingOverdueSweep();
        if (result.created > 0) {
          console.log(`[TRAINING_SWEEP] scanned=${result.scanned} created=${result.created}`);
        }
      } catch (err) {
        console.error("[TRAINING_SWEEP] failed", err);
      }
    }, { timezone: "Africa/Nairobi" });
    cron.schedule("5 6 * * *", async () => {
      try {
        const result = await deliverDailyRoleQuotes();
        if (result.created > 0) {
          console.log(`[DAILY_ROLE_QUOTES] date=${result.quoteDate} scanned=${result.scanned} created=${result.created}`);
        }
      } catch (err) {
        console.error("[DAILY_ROLE_QUOTES] failed", err);
      }
    }, { timezone: "Africa/Nairobi" });

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
    ioServer = io;
    httpServer = server;

    server.listen(PORT, () => {
      console.log(`🚀 AfyaLink HRMS backend running on port ${PORT}`);
      console.log("🌍 Allowed origins:", allowedOrigins);
    });
  } catch (err) {
    console.error("❌ Server startup failed", err);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[SHUTDOWN] received ${signal}, closing services...`);

  const forceExitTimer = setTimeout(() => {
    console.error("[SHUTDOWN] force exit after timeout");
    process.exit(1);
  }, 15000);

  try {
    if (ioServer) {
      ioServer.close();
    }

    if (httpServer) {
      await new Promise((resolve) => httpServer.close(() => resolve()));
    }

    if (mongoose.connection?.readyState) {
      await mongoose.connection.close(false);
    }

    clearTimeout(forceExitTimer);
    console.log("[SHUTDOWN] graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    console.error("[SHUTDOWN] error during graceful shutdown", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS] unhandledRejection", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[PROCESS] uncaughtException", error);
});

start();
