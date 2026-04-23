import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import mongoose from "mongoose";

import errorHandler from "./middleware/errorHandler.js";
import { trace } from "./middleware/traceMiddleware.js";
import { denyAudit } from "./middleware/denyAudit.js";
import { metricsMiddleware } from "./middleware/metricsMiddleware.js";
import { renderPrometheusMetrics } from "./utils/metrics.js";
import { authLimiter, aiGatewayLimiter } from "./middleware/trafficGuards.js";

/* ======================================================
   🌱 ENV
====================================================== */
const env = dotenv.config();
dotenvExpand.expand(env);

import "./utils/logger.js";

/* ======================================================
   🔥 BACKGROUND JOBS (DEFERRED)
   Do not block web server cold-start on job imports.
====================================================== */
export async function startBackgroundJobs(logger = console) {
  const shouldLoadBackgroundJobs =
    process.env.NODE_ENV !== "test" &&
    process.env.DISABLE_BACKGROUND_JOBS !== "1" &&
    !process.env.JEST_WORKER_ID;

  if (!shouldLoadBackgroundJobs) {
    return { started: false, reason: "disabled" };
  }

  try {
    await import("./jobs/emergencyCleanup.js");
    await import("./jobs/hospitalVerificationRecheck.js");
    await import("./workers/backgroundJobWorker.js");
    await import("./workers/notificationWorker.js");
    await import("./workers/workflowSlaWorker.js");
    logger.info?.("[BACKGROUND_JOBS] started");
    return { started: true };
  } catch (error) {
    logger.error?.("[BACKGROUND_JOBS] failed to start", error);
    return { started: false, reason: "error" };
  }
}

/* ======================================================
   🧠 ROUTES (LAZY)
   Keep startup memory low by lazy-importing route modules on first use.
====================================================== */

/* ======================================================
   🚀 APP
====================================================== */
const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
app.set("trust proxy", Number.isFinite(trustProxyHops) && trustProxyHops >= 1 ? trustProxyHops : 1);

function isDbReady() {
  return mongoose.connection?.readyState === 1;
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  return Boolean(req.secure || forwardedProto === "https");
}

function buildHstsHeader() {
  const configuredMaxAge = Number(process.env.HSTS_MAX_AGE_SECONDS || 31536000);
  const maxAge = Number.isFinite(configuredMaxAge) && configuredMaxAge > 0 ? configuredMaxAge : 31536000;
  const includeSubDomains = process.env.HSTS_INCLUDE_SUBDOMAINS !== "0";
  const preload = process.env.HSTS_PRELOAD === "1";
  return [
    `max-age=${maxAge}`,
    includeSubDomains ? "includeSubDomains" : "",
    preload ? "preload" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function lazyRouter(loadRouter, label = "lazy-router") {
  let routerPromise;
  return async function lazyExpressRouter(req, res, next) {
    try {
      if (!routerPromise) {
        routerPromise = loadRouter()
          .then((mod) => mod?.default ?? mod)
          .catch((error) => {
            // Allow retry on the next request if the import fails once.
            routerPromise = null;
            throw error;
          });
      }
      const router = await routerPromise;
      return router(req, res, next);
    } catch (error) {
      error.message = `[${label}] ${error.message}`;
      return next(error);
    }
  };
}

/* ======================================================
   🌍 CORS — OAuth & Vercel SAFE
====================================================== */
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowlist = new Set([
        process.env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
      ]);
      if (allowlist.has(origin)) return callback(null, true);
      // Dev-safe: allow localhost/127.0.0.1 on any port (e.g. Vite 5173/5174/5175)
      try {
        const parsed = new URL(origin);
        if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
          return callback(null, true);
        }
      } catch {
        // ignore invalid origin string and continue to explicit deny
      }
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Cache-Control",
      "Pragma",
      "Authorization",
      "X-Afya-View-Role",
      "X-AfyaLink-View-Role",
      "X-Afya-Strict-Impersonation",
      "X-AfyaLink-Strict-Impersonation",
      "X-Claim-Signature",
      "X-Claim-Key-Id",
    ],
  })
);

/* ======================================================
   🧱 CORE MIDDLEWARE
====================================================== */
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(trace);
app.use(metricsMiddleware);
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"), {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res) => {
      // Stored assets use content-hashed filenames (see objectStorageService),
      // so they are safe to cache aggressively.
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

/* ======================================================
   🚦 TRAFFIC GUARDS (SCALE HARDENING)
====================================================== */
app.use("/api/auth", authLimiter);
app.use("/api/ai/gateway", aiGatewayLimiter);

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  if (!isSecureRequest(req)) return next();
  res.setHeader("Strict-Transport-Security", buildHstsHeader());
  return next();
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  if (!req.path.startsWith("/api")) return next();
  if (req.path === "/api/health") return next();

  const host = String(req.hostname || "").split(":")[0].trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return next();

  if (isSecureRequest(req)) return next();

  return res.status(426).json({
    message: "Secure HTTPS connection required.",
    code: "HTTPS_REQUIRED",
  });
});

/* ======================================================
   🧊 DB READINESS GATE (FAST FAIL)
   Avoid hanging requests during cold start / DB reconnects.
====================================================== */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "afyalink-backend",
    dbReady: isDbReady(),
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  if (req.path === "/api/health") return next();
  if (isDbReady()) return next();

  return res.status(503).json({
    ok: false,
    reason: "DATABASE_NOT_READY",
    code: "DATABASE_NOT_READY",
    timestamp: new Date().toISOString(),
  });
});

/* ======================================================
   🚨 EMERGENCY
====================================================== */
app.use(
  "/api/break-glass",
  lazyRouter(() => import("./routes/breakGlassRoutes.js"), "breakGlassRoutes")
);
app.use(
  "/api/admin",
  lazyRouter(() => import("./routes/adminEmergencyRoutes.js"), "adminEmergencyRoutes")
);
app.use(
  "/api/emergency",
  lazyRouter(() => import("./routes/emergencyRoutes.js"), "emergencyRoutes")
);
app.use(
  "/api/admin",
  lazyRouter(
    () => import("./routes/emergencyDashboardRoutes.js"),
    "emergencyDashboardRoutes"
  )
);

/* ======================================================
   🔐 WORKFLOWS (READ-ONLY)
====================================================== */
app.use(
  "/api/workflows",
  lazyRouter(() => import("./routes/workflowRoutes.js"), "workflowRoutes")
);
app.use(
  "/api/workflows/admin",
  lazyRouter(
    () => import("./routes/workflowAdminRoutes.js"),
    "workflowAdminRoutes"
  )
);
app.use(
  "/api/workflows/replay",
  lazyRouter(
    () => import("./routes/workflowReplayRoutes.js"),
    "workflowReplayRoutes"
  )
);
app.use(
  "/api/admin/workflows",
  lazyRouter(
    () => import("./routes/adminWorkflowRoutes.js"),
    "adminWorkflowRoutes"
  )
);

/* ======================================================
   🧾 AUTO-AUDIT FLAG
====================================================== */
app.use((req, _res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    req._audit = true;
  }
  next();
});

/* ======================================================
   🔑 AUTH & CORE
====================================================== */
app.use(
  "/api/auth",
  lazyRouter(() => import("./routes/authRoutes.js"), "authRoutes")
);
app.use(
  "/api/admin",
  lazyRouter(() => import("./routes/admin.js"), "adminRoutes")
);
app.use(
  "/api/users",
  lazyRouter(() => import("./routes/userRoutes.js"), "userRoutes")
);
app.use(
  "/api/profile",
  lazyRouter(() => import("./routes/profileRoutes.js"), "profileRoutes")
);
app.use(
  "/api/2fa",
  lazyRouter(() => import("./routes/2faRoutes.js"), "twoFaRoutes")
);

/* ======================================================
   🏥 HOSPITAL CORE
====================================================== */
app.use(
  "/api/hospitals",
  lazyRouter(() => import("./routes/hospitalRoutes.js"), "hospitalRoutes")
);
app.use(
  "/api/hospital-admin",
  lazyRouter(
    () => import("./routes/hospitalAdminRoutes.js"),
    "hospitalAdminRoutes"
  )
);
app.use(
  "/api/hospital-admin",
  lazyRouter(() => import("./routes/hospitalAdmin.js"), "hospitalAdminStaffRoutes")
);
app.use(
  "/api/staff",
  lazyRouter(() => import("./routes/staffRoutes.js"), "staffRoutes")
);
app.use(
  "/api/super-admin",
  lazyRouter(() => import("./routes/superAdmin.js"), "superAdminRoutes")
);
app.use(
  "/api/branches",
  lazyRouter(() => import("./routes/branchesRoutes.js"), "branchesRoutes")
);
app.use(
  "/api/access-bookings",
  lazyRouter(
    () => import("./routes/accessBookingRoutes.js"),
    "accessBookingRoutes"
  )
);
app.use(
  "/api/access",
  lazyRouter(
    () => import("./routes/accessVerificationRoutes.js"),
    "accessVerificationRoutes"
  )
);
app.use(
  "/api/security",
  lazyRouter(
    () => import("./routes/securityDashboardRoutes.js"),
    "securityDashboardRoutes"
  )
);
app.use(
  "/api/notifications",
  lazyRouter(
    () => import("./routes/notificationsRoutes.js"),
    "notificationsRoutes"
  )
);
app.use(
  "/api/actions",
  lazyRouter(() => import("./routes/actionRoutes.js"), "actionRoutes")
);
app.use(
  "/api/workforce",
  lazyRouter(() => import("./routes/workforceRoutes.js"), "workforceRoutes")
);
app.use(
  "/api/system-settings",
  lazyRouter(
    () => import("./routes/systemSettingsRoutes.js"),
    "systemSettingsRoutes"
  )
);
app.use(
  "/api/developer",
  lazyRouter(() => import("./routes/developerRoutes.js"), "developerRoutes")
);
app.use(
  "/api/system-admin",
  lazyRouter(() => import("./routes/systemAdminRoutes.js"), "systemAdminRoutes")
);
app.use(
  "/api/compliance",
  lazyRouter(() => import("./routes/complianceRoutes.js"), "complianceRoutes")
);
app.use(
  "/api/government",
  lazyRouter(() => import("./routes/governmentRoutes.js"), "governmentRoutes")
);
app.use(
  "/api/dashboard",
  lazyRouter(() => import("./routes/dashboardRoutes.js"), "dashboardRoutes")
);
app.use(
  "/api/delegated-permissions",
  lazyRouter(
    () => import("./routes/delegatedPermissionRoutes.js"),
    "delegatedPermissionRoutes"
  )
);
app.use(
  "/api/search",
  lazyRouter(() => import("./routes/searchRoutes.js"), "searchRoutes")
);
app.use(
  "/api/recruitment-ads",
  lazyRouter(
    () => import("./routes/recruitmentAdsRoutes.js"),
    "recruitmentAdsRoutes"
  )
);
app.use(
  "/api/migrations",
  lazyRouter(() => import("./routes/migrationRoutes.js"), "migrationRoutes")
);
app.use(
  "/api/communication",
  lazyRouter(
    () => import("./routes/communicationRoutes.js"),
    "communicationRoutes"
  )
);
app.use(
  "/api/audit",
  lazyRouter(() => import("./routes/auditRoutes.js"), "auditRoutes")
);
app.use(
  "/api/printing",
  lazyRouter(() => import("./routes/printingRoutes.js"), "printingRoutes")
);
app.use(
  "/api/clinical-drafts",
  lazyRouter(
    () => import("./routes/clinicalDraftRoutes.js"),
    "clinicalDraftRoutes"
  )
);
app.use(
  "/api/chw",
  lazyRouter(
    () => import("./routes/communityHealthWorkerRoutes.js"),
    "communityHealthWorkerRoutes"
  )
);
app.use(
  "/api/machine-connectivity",
  lazyRouter(
    () => import("./routes/machineConnectivityRoutes.js"),
    "machineConnectivityRoutes"
  )
);
app.use(
  "/api/training",
  lazyRouter(
    () => import("./routes/trainingTrackerRoutes.js"),
    "trainingTrackerRoutes"
  )
);
app.use(
  "/api/pharmacy-network",
  lazyRouter(
    () => import("./routes/pharmacyNetworkRoutes.js"),
    "pharmacyNetworkRoutes"
  )
);
app.use(
  "/api/sre/incidents",
  lazyRouter(() => import("./routes/sreIncidentRoutes.js"), "sreIncidentRoutes")
);
app.use(
  "/api/pilot",
  lazyRouter(() => import("./routes/pilotOpsRoutes.js"), "pilotOpsRoutes")
);
app.use(
  "/api/support",
  lazyRouter(() => import("./routes/supportRoutes.js"), "supportRoutes")
);
app.use(
  "/api/customization-requests",
  lazyRouter(
    () => import("./routes/customizationRequestRoutes.js"),
    "customizationRequestRoutes"
  )
);
app.use(
  "/api/staff-transfers",
  lazyRouter(
    () => import("./routes/staffTransferRoutes.js"),
    "staffTransferRoutes"
  )
);
app.use(
  "/api/unified-assistant",
  lazyRouter(
    () => import("./routes/unifiedAssistantRoutes.js"),
    "unifiedAssistantRoutes"
  )
);
app.use(
  "/api/platform-innovation",
  lazyRouter(
    () => import("./routes/platformInnovationRoutes.js"),
    "platformInnovationRoutes"
  )
);


/* ======================================================
   🧑‍⚕️ CLINICAL
====================================================== */
app.use(
  "/api/patients",
  lazyRouter(() => import("./routes/patientRoutes.js"), "patientRoutes")
);
app.use(
  "/api/encounters",
  lazyRouter(() => import("./routes/encounterRoutes.js"), "encounterRoutes")
);
app.use(
  "/api/appointments",
  lazyRouter(
    () => import("./routes/appointmentRoutes.js"),
    "appointmentRoutes"
  )
);
app.use(
  "/api/appointments_admin",
  lazyRouter(
    () => import("./routes/appointments_adminRoutes.js"),
    "appointmentsAdminRoutes"
  )
);
app.use(
  "/api/geo",
  lazyRouter(() => import("./routes/geoRoutes.js"), "geoRoutes")
);
app.use(
  "/api/claims",
  lazyRouter(() => import("./routes/claimsRoutes.js"), "claimsRoutes")
);
app.use(
  "/api/labs",
  lazyRouter(() => import("./routes/labRoutes.js"), "labRoutes")
);
app.use(
  "/api/pharmacy",
  lazyRouter(() => import("./routes/pharmacyRoutes.js"), "pharmacyRoutes")
);
app.use(
  "/api/beds",
  lazyRouter(() => import("./routes/bedsRoutes.js"), "bedsRoutes")
);
app.use(
  "/api/triage",
  lazyRouter(() => import("./routes/triageRoutes.js"), "triageRoutes")
);

/* ======================================================
   💳 BILLING & PAYMENTS
====================================================== */
app.use(
  "/api/billing",
  lazyRouter(() => import("./routes/billingRoutes.js"), "billingRoutes")
);
app.use(
  "/api/payments",
  lazyRouter(() => import("./routes/paymentRoutes.js"), "paymentRoutes")
);
app.use(
  "/api/payments/mpesa",
  lazyRouter(() => import("./routes/mpesa.routes.js"), "mpesaRoutes")
);
app.use(
  "/api/payments/stripe",
  lazyRouter(() => import("./routes/stripeRoutes.js"), "stripeRoutes")
);
app.use(
  "/api/payments/flutterwave",
  lazyRouter(
    () => import("./routes/flutterwaveRoutes.js"),
    "flutterwaveRoutes"
  )
);
app.use(
  "/api/transactions",
  lazyRouter(
    () => import("./routes/transactionsRoutes.js"),
    "transactionsRoutes"
  )
);
app.use(
  "/api/payment-settings",
  lazyRouter(
    () => import("./routes/paymentSettingsRoutes.js"),
    "paymentSettingsRoutes"
  )
);

/* ======================================================
   📊 FINANCE & INVENTORY
====================================================== */
app.use(
  "/api/inventory",
  lazyRouter(() => import("./routes/inventoryRoutes.js"), "inventoryRoutes")
);
app.use(
  "/api/financials",
  lazyRouter(() => import("./routes/financialRoutes.js"), "financialRoutes")
);
app.use(
  "/api/transfers",
  lazyRouter(() => import("./routes/transferRoutes.js"), "transferRoutes")
);

/* ======================================================
   📈 ANALYTICS & REPORTS
====================================================== */
app.use(
  "/api/analytics",
  lazyRouter(() => import("./routes/analyticsRoutes.js"), "analyticsRoutes")
);
app.use(
  "/api/reports",
  lazyRouter(() => import("./routes/reportsRoutes.js"), "reportsRoutes")
);
app.use(
  "/api/medical-legal",
  lazyRouter(
    () => import("./routes/medicalLegalRoutes.js"),
    "medicalLegalRoutes"
  )
);

/* ======================================================
   🤖 AI / ML
====================================================== */
app.use("/api/ai", lazyRouter(() => import("./routes/aiRoutes.js"), "aiRoutes"));
app.use(
  "/api/ai_admin",
  lazyRouter(() => import("./routes/ai_adminRoutes.js"), "aiAdminRoutes")
);
app.use("/api/ml", lazyRouter(() => import("./routes/mlRoutes.js"), "mlRoutes"));

/* ======================================================
   🔌 INTEGRATIONS
====================================================== */
app.use(
  "/api/connectors",
  lazyRouter(() => import("./routes/connectorsRoutes.js"), "connectorsRoutes")
);
app.use(
  "/api/webhooks",
  lazyRouter(
    () => import("./routes/webhookReceiverRoutes.js"),
    "webhookReceiverRoutes"
  )
);
app.use(
  "/api/integrations/webhook",
  lazyRouter(
    () => import("./routes/integrationWebhookRoutes.js"),
    "integrationWebhookRoutes"
  )
);
app.use(
  "/api/integrations/dlq",
  lazyRouter(() => import("./routes/dlqRoutes.js"), "dlqRoutes")
);
app.use(
  "/api/integrations/dlq-inspect",
  lazyRouter(() => import("./routes/dlqInspectRoutes.js"), "dlqInspectRoutes")
);
app.use(
  "/api/integrations/dlq-admin",
  lazyRouter(() => import("./routes/dlqAdminRoutes.js"), "dlqAdminRoutes")
);
app.use(
  "/api/mapping",
  lazyRouter(() => import("./routes/mappingRoutes.js"), "mappingRoutes")
);
app.use(
  "/api/offline",
  lazyRouter(() => import("./routes/offlineRoutes.js"), "offlineRoutes")
);

/* ======================================================
   🧬 CRDT / SIGNALING
====================================================== */
app.use("/api/crdt", lazyRouter(() => import("./routes/crdtRoutes.js"), "crdtRoutes"));
app.use("/api/crdt-api", lazyRouter(() => import("./routes/crdtApiRoutes.js"), "crdtApiRoutes"));
app.use(
  "/api/crdt/chunks",
  lazyRouter(() => import("./routes/crdtChunkRoutes.js"), "crdtChunkRoutes")
);
app.use(
  "/api/crdt/resource",
  lazyRouter(() => import("./routes/crdtResourceRoutes.js"), "crdtResourceRoutes")
);
app.use(
  "/api/signaling",
  lazyRouter(
    () => import("./routes/signalingTokenRoutes.js"),
    "signalingTokenRoutes"
  )
);

/* ======================================================
   🛡️ INSURANCE / KPI / MENU
====================================================== */
app.use(
  "/api/insurance",
  lazyRouter(() => import("./routes/insuranceRoutes.js"), "insuranceRoutes")
);
app.use(
  "/api/admin/kpis",
  lazyRouter(() => import("./routes/kpiRoutes.js"), "kpiRoutes")
);
app.use(
  "/api/menu",
  lazyRouter(() => import("./routes/menuRoutes.js"), "menuRoutes")
);

/* ======================================================
   ❤️ HEALTH CHECK
====================================================== */
app.get("/", (_req, res) => {
  res.send("AfyaLink HRMS Backend is running");
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "afyalink-backend",
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/readyz", async (_req, res) => {
  try {
    const dbReady = mongoose.connection?.readyState === 1;
    if (!dbReady) {
      return res.status(503).json({
        ok: false,
        reason: "DATABASE_NOT_READY",
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      ok: true,
      service: "afyalink-backend",
      dbReady: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      reason: "READINESS_CHECK_FAILED",
      message: error?.message || "Unknown readiness error",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/metrics", (req, res) => {
  const configuredToken = process.env.METRICS_TOKEN || "";
  if (configuredToken) {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token || token !== configuredToken) {
      return res.status(401).json({ message: "Unauthorized metrics access" });
    }
  }

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return res.status(200).send(renderPrometheusMetrics());
});

/* ======================================================
   🚫 UNKNOWN ROUTES → DENY AUDIT
====================================================== */
app.use(async (req, res) => {
  if (req.user) {
    await denyAudit(req, res, "Unknown or unmapped route access");
  }
  res.status(404).json({ message: "Not found" });
});

/* ======================================================
   ❌ ERROR HANDLER
====================================================== */
app.use(errorHandler);

export default app;
