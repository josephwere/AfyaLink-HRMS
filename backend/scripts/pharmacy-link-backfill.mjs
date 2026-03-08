import mongoose from "mongoose";
import dotenv from "dotenv";
import { runPharmacyLinkBackfill } from "../services/pharmacyLinkBackfillService.js";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error("Missing MONGO_URI");
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);

  const result = await runPharmacyLinkBackfill({ dryRun });

  for (const item of result.matched) {
    console.log(`${dryRun ? "[DRY-RUN]" : "[LINK]"} ${item.user.name} -> ${item.pharmacy.name}`);
  }

  for (const item of result.ambiguous) {
    console.log(
      `[AMBIGUOUS] ${item.user.name} <${item.user.email || "no-email"}> matches ${item.candidates
        .map((candidate) => candidate.name)
        .join(", ")}`
    );
  }

  console.log("");
  console.log("Pharmacy linkage backfill summary");
  console.log(`  pharmacists scanned: ${result.scanned}`);
  console.log(`  matched: ${result.matched.length}`);
  console.log(`  updated: ${result.updated}`);
  console.log(`  ambiguous: ${result.ambiguous.length}`);
  console.log(`  skipped: ${result.skipped.length}`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("pharmacy-link-backfill failed:", err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
