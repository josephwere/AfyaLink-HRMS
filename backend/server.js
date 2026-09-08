import http from "http";
import cron from "node-cron";
import { Server as IOServer } from "socket.io";
import mongoose from "mongoose";
import "./config/loadEnv.js";

import connectDB from "./config/db.js";
import { validateRuntimeEnv } from "./config/validateEnv.js";
import app, { startBackgroundJobs } from "./app.js";
import { getAllowedOrigins, isAllowedOrigin } from "./utils/corsOrigins.js";
import { initSocket } from "./utils/socket.js";

const PORT = process.env.PORT || 5000;
let httpServer;
let ioServer;
let shuttingDown = false;
const KEEP_ALIVE_TIMEOUT_MS = Math.max(Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 65000) || 65000, 1000);
const HEADERS_TIMEOUT_MS = Math.max(Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 66000) || 66000, KEEP_ALIVE_TIMEOUT_MS + 1000);
const REQUEST_TIMEOUT_MS = Math.max(Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 30000) || 30000, 1000);
const MAX_REQUESTS_PER_SOCKET = Math.max(Number(process.env.HTTP_MAX_REQUESTS_PER_SOCKET || 1000) || 1000, 100);

/* ======================================================
   🌐 ALLOWED ORIGINS
====================================================== */
const allowedOrigins = getAllowedOrigins();

async function safeBootstrapStep(label, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`[BOOTSTRAP] ${label} failed`, error);
  }
}

async function bootstrapAfterDbConnect() {
  await safeBootstrapStep("seedSuperAdmin", async () => {
    const { default: seedSuperAdmin } = await import("./seed/superAdmin.js");
    await seedSuperAdmin();
  });

  await safeBootstrapStep("aiAssistantBootstrap", async () => {
    const { runAiAssistantBootstrap } = await import("./utils/aiAssistantBootstrap.js");
    await runAiAssistantBootstrap();
  });

  await safeBootstrapStep("presentationSeed", async () => {
    if (String(process.env.AFYALINK_PRESENTATION_SEED_ON_BOOT || "").toUpperCase() !== "YES") {
      return;
    }
    process.env.AFYALINK_PRESENTATION_PRINT_PASSWORDS =
      process.env.AFYALINK_PRESENTATION_PRINT_PASSWORDS || "0";
    const { runPresentationSeed } = await import("./scripts/seedPresentationData.mjs");
    await runPresentationSeed({
      manageConnection: false,
      requireConfirm: false,
      logger: console,
    });
  });

  // Signal to health/readiness that presentation seed completed.
  try {
    const readiness = await import("./utils/readiness.js");
    if (readiness && readiness.default) {
      readiness.default.presentationSeedReady = true;
    }
  } catch (e) {
    // non-fatal
  }

  await safeBootstrapStep("backgroundJobs", async () => {
    await startBackgroundJobs();
  });

  await safeBootstrapStep("invoiceAggregationConsumer", async () => {
    const { startInvoiceAggregationConsumer } = await import("./services/invoiceAggregationConsumer.js");
    startInvoiceAggregationConsumer();
  });

  await safeBootstrapStep("outboxWorker", async () => {
    const { startOutboxWorker } = await import("./services/outboxWorkerService.js");
    startOutboxWorker({ intervalMs: 5000 });
  });

  await safeBootstrapStep("systemSettingsAssetMigration", async () => {
    const { runSystemSettingsAssetMigration } = await import(
      "./workers/systemSettingsAssetMigration.js"
    );
    await runSystemSettingsAssetMigration();
  });

  scheduleCronJobs();
}

function scheduleCronJobs() {
  if (process.env.DISABLE_CRON === "1") {
    console.warn("[CRON] disabled via DISABLE_CRON=1");
    return;
  }

  const tz = "Africa/Nairobi";

  // Lazy-import cron tasks so the web process stays lean on cold start (Render 512MB, etc).
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        const { cleanupUnverifiedUsers } = await import("./workers/verificationCleanup.js");
        await cleanupUnverifiedUsers();
      } catch (err) {
        console.error("[CRON] cleanupUnverifiedUsers failed", err);
      }
    },
    { timezone: tz }
  );

  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const { cleanupExpiredBreakGlass } = await import("./workers/breakGlassCleanup.js");
        await cleanupExpiredBreakGlass();
      } catch (err) {
        console.error("[CRON] cleanupExpiredBreakGlass failed", err);
      }
    },
    { timezone: tz }
  );

  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const { cleanupExpiredEmergencyAccess } = await import("./workers/emergencyCleanup.js");
        await cleanupExpiredEmergencyAccess();
      } catch (err) {
        console.error("[CRON] cleanupExpiredEmergencyAccess failed", err);
      }
    },
    { timezone: tz }
  );

  cron.schedule("*/10 * * * *", async () => {
    try {
      const { runWorkforceAutomationSweep } = await import("./workers/workforceAutomationSweep.js");
      const result = await runWorkforceAutomationSweep();
      if (result.escalated > 0) {
        console.log(
          `[WORKFORCE_SWEEP] escalated=${result.escalated} scannedPolicies=${result.scannedPolicies}`
        );
      }
    } catch (err) {
      console.error("[WORKFORCE_SWEEP] failed", err);
    }
  }, { timezone: tz });
  cron.schedule("0 * * * *", async () => {
    try {
      const { runSubscriptionLifecycleSweep } = await import(
        "./workers/subscriptionLifecycleWorker.js"
      );
      const result = await runSubscriptionLifecycleSweep();
      if (result.updated > 0) {
        console.log(`[SUBSCRIPTION_SWEEP] scanned=${result.scanned} updated=${result.updated}`);
      }
    } catch (err) {
      console.error("[SUBSCRIPTION_SWEEP] failed", err);
    }
  }, { timezone: tz });
  cron.schedule("30 1 * * *", async () => {
    try {
      const { runDataRetentionCleanup } = await import("./workers/dataRetentionCleanup.js");
      await runDataRetentionCleanup();
    } catch (err) {
      console.error("[DATA_RETENTION] failed", err);
    }
  }, { timezone: tz });
  cron.schedule("15 */3 * * *", async () => {
    try {
      const { runTrainingOverdueSweep } = await import("./workers/trainingOverdueWorker.js");
      const result = await runTrainingOverdueSweep();
      if (result.created > 0) {
        console.log(`[TRAINING_SWEEP] scanned=${result.scanned} created=${result.created}`);
      }
    } catch (err) {
      console.error("[TRAINING_SWEEP] failed", err);
    }
  }, { timezone: tz });
  cron.schedule("5 6 * * *", async () => {
    try {
      const { deliverDailyRoleQuotes } = await import("./services/dailyRoleQuoteService.js");
      const result = await deliverDailyRoleQuotes();
      if (result.created > 0) {
        console.log(`[DAILY_ROLE_QUOTES] date=${result.quoteDate} scanned=${result.scanned} created=${result.created}`);
      }
    } catch (err) {
      console.error("[DAILY_ROLE_QUOTES] failed", err);
    }
  }, { timezone: tz });
}

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

    const server = http.createServer(app);
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.maxRequestsPerSocket = MAX_REQUESTS_PER_SOCKET;

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

    // Connect DB and start background components without blocking the HTTP listener.
    connectDB()
      .then(() => {
        bootstrapAfterDbConnect().catch((err) => {
          console.error("[BOOTSTRAP] unexpected bootstrap failure", err);
        });
      })
      .catch((err) => {
        console.error("❌ DB bootstrap failed", err);
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
