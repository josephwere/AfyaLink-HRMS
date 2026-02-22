import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../models/AuditLog.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/afyalink";
const retentionDays = Number(process.env.AUDIT_RETENTION_DAYS || 365);
const dryRun = process.argv.includes("--dry-run");

if (!Number.isFinite(retentionDays) || retentionDays < 30) {
  console.error("FAIL audit-retention-sweep: AUDIT_RETENTION_DAYS must be >= 30");
  process.exit(1);
}

const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

async function run() {
  await mongoose.connect(MONGO_URI);

  // Preserve legally held logs.
  const filter = {
    createdAt: { $lt: cutoff },
    $or: [
      { "metadata.legalHold": { $exists: false } },
      { "metadata.legalHold": { $ne: true } },
    ],
  };

  const count = await AuditLog.countDocuments(filter);
  if (dryRun) {
    console.log(
      `PASS audit-retention-sweep dry-run: ${count} logs older than ${retentionDays} days eligible for deletion`
    );
    return;
  }

  const result = await AuditLog.deleteMany(filter);
  console.log(
    `PASS audit-retention-sweep: deleted ${result.deletedCount} logs older than ${retentionDays} days`
  );
}

run()
  .catch((err) => {
    console.error("FAIL audit-retention-sweep:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });

