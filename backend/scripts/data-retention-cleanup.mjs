import mongoose from "mongoose";
import dotenv from "dotenv";
import { runDataRetentionCleanup } from "../workers/dataRetentionCleanup.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error("FAIL data-retention-cleanup: MONGO_URI is required");
  process.exit(1);
}

try {
  await mongoose.connect(mongoUri);
  const result = await runDataRetentionCleanup();
  if (!result.ok) {
    console.error("FAIL data-retention-cleanup:", result.error || "unknown error");
    process.exit(1);
  }

  console.log(
    `PASS data-retention-cleanup: purged_accounts=${result.accountPurge.deletedCount} deleted_export_artifacts=${result.exportArtifacts.deletedFiles}`
  );
  process.exit(0);
} catch (error) {
  console.error("FAIL data-retention-cleanup:", error?.message || error);
  process.exit(1);
} finally {
  if (mongoose.connection?.readyState) {
    await mongoose.disconnect();
  }
}
