import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

import errorHandler from "./middleware/errorHandler.js";
import { trace } from "./middleware/traceMiddleware.js";
import { denyAudit } from "./middleware/denyAudit.js";

/* ======================================================
   🌱 ENV
====================================================== */
const env = dotenv.config();
dotenvExpand.expand(env);

import "./utils/logger.js";

/* ======================================================
   🔥 BACKGROUND JOBS
====================================================== */
import "./jobs/emergencyCleanup.js";
import "./workers/notificationWorker.js";
import "./workers/workflowSlaWorker.js";

/* ======================================================
   🧠 ROUTES
====================================================== */
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import hospitalAdminRoutes from "./routes/hospitalAdminRoutes.js";
import hospitalAdminStaffRoutes from "./routes/hospitalAdmin.js";
import staffRoutes from "./routes/staffRoutes.js";
import superAdminRoutes from "./routes/superAdmin.js";

import emergencyRoutes from "./routes/emergencyRoutes.js";
import adminEmergencyRoutes from "./routes/adminEmergencyRoutes.js";
import emergencyDashboardRoutes from "./routes/emergencyDashboardRoutes.js";
import breakGlassRoutes from "./routes/breakGlassRoutes.js";

import workflowRoutes from "./routes/workflowRoutes.js";
import workflowAdminRoutes from "./routes/workflowAdminRoutes.js";
import workflowReplayRoutes from "./routes/workflowReplayRoutes.js";
import adminWorkflowRoutes from "./routes/adminWorkflowRoutes.js";

import patientRoutes from "./routes/patientRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import appointmentsAdminRoutes from "./routes/appointments_adminRoutes.js";

import labRoutes from "./routes/labRoutes.js";
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import bedsRoutes from "./routes/bedsRoutes.js";
import triageRoutes from "./routes/triageRoutes.js";

import billingRoutes from "./routes/billingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import mpesaRoutes from "./routes/mpesa.routes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import flutterwaveRoutes from "./routes/flutterwaveRoutes.js";
import transactionsRoutes from "./routes/transactionsRoutes.js";
import paymentSettingsRoutes from "./routes/paymentSettingsRoutes.js";

import inventoryRoutes from "./routes/inventoryRoutes.js";
import financialRoutes from "./routes/financialRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";

import analyticsRoutes from "./routes/analyticsRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";

import aiRoutes from "./routes/aiRoutes.js";
import aiAdminRoutes from "./routes/ai_adminRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";

import connectorsRoutes from "./routes/connectorsRoutes.js";
import webhookReceiverRoutes from "./routes/webhookReceiverRoutes.js";
import integrationWebhookRoutes from "./routes/integrationWebhookRoutes.js";
import dlqRoutes from "./routes/dlqRoutes.js";
import dlqInspectRoutes from "./routes/dlqInspectRoutes.js";
import dlqAdminRoutes from "./routes/dlqAdminRoutes.js";

import mappingRoutes from "./routes/mappingRoutes.js";
import offlineRoutes from "./routes/offlineRoutes.js";

import crdtRoutes from "./routes/crdtRoutes.js";
import crdtApiRoutes from "./routes/crdtApiRoutes.js";
import crdtChunkRoutes from "./routes/crdtChunkRoutes.js";
import crdtResourceRoutes from "./routes/crdtResourceRoutes.js";
import signalingTokenRoutes from "./routes/signalingTokenRoutes.js";

import insuranceRoutes from "./routes/insuranceRoutes.js";
import branchesRoutes from "./routes/branchesRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import accessVerificationRoutes from "./routes/accessVerificationRoutes.js";
import securityDashboardRoutes from "./routes/securityDashboardRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";
import twoFaRoutes from "./routes/2faRoutes.js";
import actionRoutes from "./routes/actionRoutes.js";
import workforceRoutes from "./routes/workforceRoutes.js";
import systemSettingsRoutes from "./routes/systemSettingsRoutes.js";
import developerRoutes from "./routes/developerRoutes.js";
import systemAdminRoutes from "./routes/systemAdminRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";




/* ======================================================
   🚀 APP
====================================================== */
const app = express();

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
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Afya-View-Role",
      "X-AfyaLink-View-Role",
      "X-Afya-Strict-Impersonation",
      "X-AfyaLink-Strict-Impersonation",
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

/* ======================================================
   🚨 EMERGENCY
====================================================== */
app.use("/api/break-glass", breakGlassRoutes);
app.use("/api/admin", adminEmergencyRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/admin", emergencyDashboardRoutes);

/* ======================================================
   🔐 WORKFLOWS (READ-ONLY)
====================================================== */
app.use("/api/workflows", workflowRoutes);
app.use("/api/workflows/admin", workflowAdminRoutes);
app.use("/api/workflows/replay", workflowReplayRoutes);
app.use("/api/admin/workflows", adminWorkflowRoutes);

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
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/2fa", twoFaRoutes);

/* ======================================================
   🏥 HOSPITAL CORE
====================================================== */
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/hospital-admin", hospitalAdminRoutes);
app.use("/api/hospital-admin", hospitalAdminStaffRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/access", accessVerificationRoutes);
app.use("/api/security", securityDashboardRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/actions", actionRoutes);
app.use("/api/workforce", workforceRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/system-admin", systemAdminRoutes);
app.use("/api/dashboard", dashboardRoutes);


/* ======================================================
   🧑‍⚕️ CLINICAL
====================================================== */
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/appointments_admin", appointmentsAdminRoutes);
app.use("/api/labs", labRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/beds", bedsRoutes);
app.use("/api/triage", triageRoutes);

/* ======================================================
   💳 BILLING & PAYMENTS
====================================================== */
app.use("/api/billing", billingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments/mpesa", mpesaRoutes);
app.use("/api/payments/stripe", stripeRoutes);
app.use("/api/payments/flutterwave", flutterwaveRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);

/* ======================================================
   📊 FINANCE & INVENTORY
====================================================== */
app.use("/api/inventory", inventoryRoutes);
app.use("/api/financials", financialRoutes);
app.use("/api/transfers", transferRoutes);

/* ======================================================
   📈 ANALYTICS & REPORTS
====================================================== */
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportsRoutes);

/* ======================================================
   🤖 AI / ML
====================================================== */
app.use("/api/ai", aiRoutes);
app.use("/api/ai_admin", aiAdminRoutes);
app.use("/api/ml", mlRoutes);

/* ======================================================
   🔌 INTEGRATIONS
====================================================== */
app.use("/api/connectors", connectorsRoutes);
app.use("/api/webhooks", webhookReceiverRoutes);
app.use("/api/integrations/webhook", integrationWebhookRoutes);
app.use("/api/integrations/dlq", dlqRoutes);
app.use("/api/integrations/dlq-inspect", dlqInspectRoutes);
app.use("/api/integrations/dlq-admin", dlqAdminRoutes);
app.use("/api/mapping", mappingRoutes);
app.use("/api/offline", offlineRoutes);

/* ======================================================
   🧬 CRDT / SIGNALING
====================================================== */
app.use("/api/crdt", crdtRoutes);
app.use("/api/crdt-api", crdtApiRoutes);
app.use("/api/crdt/chunks", crdtChunkRoutes);
app.use("/api/crdt/resource", crdtResourceRoutes);
app.use("/api/signaling", signalingTokenRoutes);

/* ======================================================
   🛡️ INSURANCE / KPI / MENU
====================================================== */
app.use("/api/insurance", insuranceRoutes);
app.use("/api/admin/kpis", kpiRoutes);
app.use("/api/menu", menuRoutes);

/* ======================================================
   ❤️ HEALTH CHECK
====================================================== */
app.get("/", (_req, res) => {
  res.send("AfyaLink HRMS Backend is running 🚀");
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
