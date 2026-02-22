import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/afyalink";
const windowHours = Number(process.env.HYPERCARE_WINDOW_HOURS || 24);
const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

async function run() {
  await mongoose.connect(MONGO_URI);

  const [
    unreadIntegration,
    unreadTraining,
    connectorBreaches,
    failedAuditActions,
  ] = await Promise.all([
    Notification.countDocuments({ category: "INTEGRATION", read: false, createdAt: { $gte: since } }),
    Notification.countDocuments({ category: "TRAINING", read: false, createdAt: { $gte: since } }),
    ConnectorSlaEvent.countDocuments({ breach: true, createdAt: { $gte: since } }),
    AuditLog.countDocuments({ success: false, createdAt: { $gte: since } }),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    windowHours,
    since: since.toISOString(),
    metrics: {
      unreadIntegration,
      unreadTraining,
      connectorBreaches,
      failedAuditActions,
    },
  };

  const outDir = path.join(root, "backend", "artifacts", "hypercare");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `snapshot-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2));

  console.log(`PASS hypercare-kpi-snapshot: ${path.relative(root, outFile)}`);
}

run()
  .catch((err) => {
    console.error("FAIL hypercare-kpi-snapshot:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });
