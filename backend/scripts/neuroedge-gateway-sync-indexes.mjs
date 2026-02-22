import dotenv from "dotenv";
import mongoose from "mongoose";
import AIGatewayJob from "../models/AIGatewayJob.js";
import AIGatewayDecision from "../models/AIGatewayDecision.js";
import AIGatewayProvenance from "../models/AIGatewayProvenance.js";
import AIGatewayIdempotencyLedger from "../models/AIGatewayIdempotencyLedger.js";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error("Missing MONGO_URI/MONGODB_URI in environment");
}

async function sync(model) {
  await model.syncIndexes();
  return model.modelName;
}

async function main() {
  await mongoose.connect(mongoUri, { autoIndex: true });
  const synced = [];
  synced.push(await sync(AIGatewayJob));
  synced.push(await sync(AIGatewayDecision));
  synced.push(await sync(AIGatewayProvenance));
  synced.push(await sync(AIGatewayIdempotencyLedger));

  console.log("NeuroEdge gateway indexes synced:", synced.join(", "));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Failed to sync NeuroEdge gateway indexes", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
