import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { runPresentationSeed } from "./seedPresentationData.mjs";
import { runTestHospitalsSeed } from "./seedTestHospitals.js";

dotenv.config();

const args = process.argv.slice(2);
const mode = args.find((arg) => arg.startsWith("--")) || "--all";

async function run() {
  switch (mode) {
    case "--presentation":
      console.log("🟦 Running presentation seed...");
      await runPresentationSeed({ requireConfirm: true });
      break;
    case "--development":
      console.log("🟩 Running development seed...");
      await runTestHospitalsSeed();
      break;
    case "--all":
      console.log("🟪 Running both presentation and development seeds...");
      await runPresentationSeed({ requireConfirm: true });
      await runTestHospitalsSeed();
      break;
    default:
      console.error(`Unknown seed mode: ${mode}`);
      console.error("Usage: node scripts/seedAll.js [--presentation|--development|--all]");
      process.exit(1);
  }
}

run().catch((error) => {
  console.error("seedAll failed:", error);
  process.exit(1);
});
