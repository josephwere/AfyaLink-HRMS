import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CURRENT_REPORT = path.join(ROOT, "docs", "page-migration-matrix.json");
const PREVIOUS_REPORT = path.join(ROOT, "docs", "page-migration-matrix.previous.json");

async function main() {
  try {
    const currentRaw = await fs.readFile(CURRENT_REPORT, "utf8");
    const current = JSON.parse(currentRaw);
    const previousRaw = await fs.readFile(PREVIOUS_REPORT, "utf8");
    const previous = JSON.parse(previousRaw);

    const currentRemaining = current.summary.remainingPages;
    const previousRemaining = previous.summary.remainingPages;

    if (currentRemaining > previousRemaining) {
      console.error(`Migration regression detected: remaining pages increased from ${previousRemaining} to ${currentRemaining}.`);
      process.exit(1);
    }

    console.log(`Migration regression check passed: remaining pages ${previousRemaining} -> ${currentRemaining}.`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log("No previous migration report found; skipping regression check.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
