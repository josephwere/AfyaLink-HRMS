import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import AIGatewayJob from "../models/AIGatewayJob.js";
import AIGatewayDecision from "../models/AIGatewayDecision.js";
import AIGatewayProvenance from "../models/AIGatewayProvenance.js";
import AIGatewayIdempotencyLedger from "../models/AIGatewayIdempotencyLedger.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import Hospital from "../models/Hospital.js";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, "backend", "artifacts", "perf");
const outputFile = path.join(outputDir, "index-audit-latest.json");

const WITH_DB = process.argv.includes("--with-db");

const REQUIRED = [
  { model: AIGatewayJob, key: { tenantId: 1, hospital: 1, createdAt: -1 } },
  { model: AIGatewayJob, key: { endpoint: 1, status: 1, createdAt: -1 } },
  { model: AIGatewayDecision, key: { tenantId: 1, hospital: 1, createdAt: -1 } },
  { model: AIGatewayProvenance, key: { correlationId: 1, createdAt: -1 } },
  {
    model: AIGatewayIdempotencyLedger,
    key: { endpoint: 1, actorId: 1, tenantId: 1, hospital: 1, idempotencyKey: 1 },
  },
  { model: Appointment, key: { hospital: 1, scheduledAt: -1 } },
  { model: Appointment, key: { patient: 1, scheduledAt: -1 } },
  { model: Patient, key: { hospital: 1, active: 1, createdAt: -1 } },
  { model: Hospital, key: { active: 1, createdAt: -1 } },
];

function keySignature(keyObj) {
  return Object.entries(keyObj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

function modelIndexes(model) {
  return model.schema.indexes().map(([key, opts]) => ({
    key,
    name: opts?.name || null,
    unique: Boolean(opts?.unique),
    expireAfterSeconds: opts?.expireAfterSeconds ?? null,
  }));
}

async function verifySchemaIndexes() {
  const byModel = new Map();
  for (const req of REQUIRED) {
    const modelName = req.model.modelName;
    if (!byModel.has(modelName)) byModel.set(modelName, modelIndexes(req.model));
  }

  const missing = [];
  for (const req of REQUIRED) {
    const modelName = req.model.modelName;
    const existing = byModel.get(modelName);
    const wanted = keySignature(req.key);
    const exists = existing.some((idx) => keySignature(idx.key) === wanted);
    if (!exists) {
      missing.push({ model: modelName, key: req.key });
    }
  }
  return missing;
}

async function verifyLiveDbIndexes() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGO_URI/MONGODB_URI for --with-db mode");

  await mongoose.connect(mongoUri, { autoIndex: false });
  const byModel = new Map();
  const models = [...new Set(REQUIRED.map((r) => r.model))];
  for (const m of models) {
    byModel.set(m.modelName, await m.collection.indexes());
  }

  const missing = [];
  for (const req of REQUIRED) {
    const modelName = req.model.modelName;
    const wanted = keySignature(req.key);
    const existing = byModel.get(modelName) || [];
    const exists = existing.some((idx) => keySignature(idx.key || {}) === wanted);
    if (!exists) missing.push({ model: modelName, key: req.key });
  }

  await mongoose.disconnect();
  return missing;
}

async function main() {
  const startedAt = new Date().toISOString();
  const schemaMissing = await verifySchemaIndexes();

  let dbMissing = [];
  let dbCheck = "skipped";
  let dbError = null;
  if (WITH_DB) {
    dbCheck = "executed";
    try {
      dbMissing = await verifyLiveDbIndexes();
    } catch (err) {
      dbError = err.message;
    }
  }

  const summary = {
    startedAt,
    withDb: WITH_DB,
    dbCheck,
    schemaMissingCount: schemaMissing.length,
    dbMissingCount: dbMissing.length,
    dbError,
    schemaMissing,
    dbMissing,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

  if (schemaMissing.length > 0) {
    console.error("FAIL index-readiness-audit: missing schema indexes");
    schemaMissing.forEach((m) => console.error(` - ${m.model} ${JSON.stringify(m.key)}`));
    process.exit(1);
  }

  if (WITH_DB && (dbMissing.length > 0 || dbError)) {
    console.error("FAIL index-readiness-audit: live DB index verification failed");
    if (dbError) console.error(` - ${dbError}`);
    dbMissing.forEach((m) => console.error(` - ${m.model} ${JSON.stringify(m.key)}`));
    process.exit(1);
  }

  console.log(
    `PASS index-readiness-audit: schema=${REQUIRED.length - schemaMissing.length}/${REQUIRED.length}` +
      (WITH_DB ? ` db=${REQUIRED.length - dbMissing.length}/${REQUIRED.length}` : "")
  );
  console.log(`Artifact: ${path.relative(repoRoot, outputFile)}`);
}

main().catch((err) => {
  console.error("FAIL index-readiness-audit", err);
  process.exit(1);
});
