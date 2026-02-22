import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const rolloutRoot = path.join(root, "backend", "artifacts", "global-rollout");
const outDir = path.join(root, "backend", "ops", "global", "waves");
fs.mkdirSync(outDir, { recursive: true });

const countries = fs.existsSync(rolloutRoot)
  ? fs.readdirSync(rolloutRoot).filter((name) => fs.statSync(path.join(rolloutRoot, name)).isDirectory())
  : [];

const wavePlan = {
  generatedAt: new Date().toISOString(),
  assumptions: {
    maxCountriesPerWave: 3,
    requiredGreenWorkstreams: ["legal", "dataResidency", "integrations", "security", "support"],
  },
  waves: [],
};

const waveSize = 3;
for (let i = 0; i < countries.length; i += waveSize) {
  wavePlan.waves.push({
    wave: Math.floor(i / waveSize) + 1,
    countries: countries.slice(i, i + waveSize),
    status: "PLANNED",
  });
}

const outFile = path.join(outDir, `wave-plan-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(wavePlan, null, 2));
console.log(`PASS global-wave-plan: ${path.relative(root, outFile)}`);
