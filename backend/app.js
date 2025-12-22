import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

// Load env
const env = dotenv.config();
dotenvExpand.expand(env);

import "./utils/logger.js";

// =======================
// ROUTES
// =======================
import workflowReplayRoutes from "./routes/workflowReplayRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import appointmentsAdminRoutes from "./routes/appointments_adminRoutes.js";
import labRoutes from "./routes/labRoutes.js";
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import mpesaRoutes from "./routes/mpesa.routes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import flutterwaveRoutes from "./routes/flutterwaveRoutes.js";
import transactionsRoutes from "./routes/transactionsRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import financialRoutes from "./routes/financialRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import branchesRoutes from "./routes/branchesRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import aiAdminRoutes from "./routes/ai_adminRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";
import bedsRoutes from "./routes/bedsRoutes.js";
import triageRoutes from "./routes/triageRoutes.js";
import connectorsRoutes from "./routes/connectorsRoutes.js";
import paymentSettingsRoutes from "./routes/paymentSettingsRoutes.js";
import webhookReceiverRoutes from "./routes/webhookReceiverRoutes.js";
import integrationWebhookRoutes from "./routes/integrationWebhookRoutes.js";
import mappingRoutes from "./routes/mappingRoutes.js";
import offlineRoutes from "./routes/offlineRoutes.js";
import dlqRoutes from "./routes/dlqRoutes.js";
import dlqInspectRoutes from "./routes/dlqInspectRoutes.js";
import dlqAdminRoutes from "./routes/dlqAdminRoutes.js";
import crdtRoutes from "./routes/crdtRoutes.js";
import crdtApiRoutes from "./routes/crdtApiRoutes.js";
import crdtChunkRoutes from "./routes/crdtChunkRoutes.js";
import signalingTokenRoutes from "./routes/signalingTokenRoutes.js";
import insuranceRoutes from "./routes/insuranceRoutes.js";
import kpiRoutes from "./routes/kpiRoutes.js";

// 🔐 WORKFLOW (READ-ONLY)
import workflowRoutes from "./routes/workflowRoutes.js";
import workflowAdminRoutes from "./routes/workflowAdminRoutes.js";
import adminWorkflowRoutes from "./routes/adminWorkflowRoutes.js";

import errorHandler from "./middleware/errorHandler.js";

// Workers
import "./workers/notificationWorker.js";
import "./workers/workflowSlaWorker.js";


const app = express();

// =======================================================
// CORS (PRODUCTION SAFE)
// =======================================================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (origin === process.env.FRONTEND_URL) return callback(null, true);
      return callback(null, true); // temporary safe fallback
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// =======================================================
// insurance
// =======================================================
app.use("/api/insurance", insuranceRoutes);


// =======================================================
// CORE MIDDLEWARE
// =======================================================
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// =======================================================
// WORKFLOW (READ-ONLY, NO MUTATIONS)
// =======================================================
app.use("/api/workflows", workflowRoutes);
app.use("/api/workflows/admin", workflowAdminRoutes);
app.use("/api/workflows/replay", workflowReplayRoutes);
app.use("/api/admin/workflows", adminWorkflowRoutes);

// =======================================================
// AUTO-AUDIT FLAG (ALL MUTATIONS)
// =======================================================
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    req._audit = true;
  }
  next();
});

// =======================================================
// AUTH & CORE
// =======================================================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);

// =======================================================
// HOSPITAL CORE
// =======================================================
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/appointments_admin", appointmentsAdminRoutes);

// =======================================================
// CLINICAL
// =======================================================
app.use("/api/labs", labRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/beds", bedsRoutes);
app.use("/api/triage", triageRoutes);

// =======================================================
// BILLING & PAYMENTS
// =======================================================
app.use("/api/billing", billingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments/mpesa", mpesaRoutes);
app.use("/api/payments/stripe", stripeRoutes);
app.use("/api/payments/flutterwave", flutterwaveRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);

// =======================================================
// INVENTORY & FINANCE
// =======================================================
app.use("/api/inventory", inventoryRoutes);
app.use("/api/financials", financialRoutes);
app.use("/api/transfers", transferRoutes);

// =======================================================
// ANALYTICS & REPORTS
// =======================================================
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reports", reportsRoutes);

// =======================================================
// AI / ML
// =======================================================
app.use("/api/ai", aiRoutes);
app.use("/api/ai_admin", aiAdminRoutes);
app.use("/api/ml", mlRoutes);

// =======================================================
// INTEGRATIONS
// =======================================================
app.use("/api/connectors", connectorsRoutes);
app.use("/api/webhooks", webhookReceiverRoutes);
app.use("/api/integrations/webhook", integrationWebhookRoutes);
app.use("/api/integrations/dlq", dlqRoutes);
app.use("/api/integrations/dlq-inspect", dlqInspectRoutes);
app.use("/api/integrations/dlq-admin", dlqAdminRoutes);
app.use("/api/mapping", mappingRoutes);
app.use("/api/offline", offlineRoutes);
app.use("/api/admin/kpis", kpiRoutes);

// =======================================================
// CRDT & SIGNALING
// =======================================================
app.use("/api/crdt", crdtRoutes);
app.use("/api/crdt-api", crdtApiRoutes);
app.use("/api/crdt/chunks", crdtChunkRoutes);
app.use("/api/signaling", signalingTokenRoutes);

// =======================================================
// HEALTH CHECK
// =======================================================
app.get("/", (req, res) => {
  res.send("AfyaLink HRMS Backend is running 🚀");
});

// =======================================================
// ERROR HANDLER (LAST)
// =======================================================
app.use(errorHandler);

export default app;
