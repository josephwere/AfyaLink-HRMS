import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return null;
  const result = dotenv.config({ path: filePath, override });
  dotenvExpand.expand(result);
  return result;
}

loadEnvFile(path.join(backendRoot, ".env"));
loadEnvFile(path.join(backendRoot, ".env.local"), { override: true });

export default process.env;
