#!/usr/bin/env node

import process from "process";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { validateRuntimeEnv } from "../config/validateEnv.js";

dotenv.config();

function fail(message) {
  console.error(`FAIL production-preflight: ${message}`);
  process.exit(1);
}

async function checkMongo(mongoUri) {
  try {
    const conn = await mongoose.createConnection(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 2,
    }).asPromise();
    await conn.close();
    return true;
  } catch (err) {
    fail(`MongoDB connectivity failed: ${err.message}`);
  }
}

async function main() {
  const mode = process.env.NODE_ENV || "production";
  const envCheck = validateRuntimeEnv({ mode });
  if (!envCheck.ok) {
    for (const err of envCheck.errors) console.error(` - ${err}`);
    fail("missing/unsafe required env");
  }

  if (envCheck.warnings.length) {
    console.warn("WARN production-preflight:");
    for (const warn of envCheck.warnings) console.warn(` - ${warn}`);
  }

  await checkMongo(process.env.MONGO_URI);
  if (!process.env.REDIS_URL && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) fail("Redis configuration is required for production queues and coordination");
  if (process.env.PPB_REGISTRY_URL && !process.env.PPB_API_KEY) fail("PPB_API_KEY is required when PPB_REGISTRY_URL is configured");
  if (process.env.PPB_API_KEY && !process.env.PPB_REGISTRY_URL) fail("PPB_REGISTRY_URL is required when PPB_API_KEY is configured");
  if (!process.env.CORS_ORIGIN) fail("CORS_ORIGIN must explicitly allowlist the production frontend");
  console.log("PASS production-preflight: env, database, Redis, PPB pairing, and CORS configuration look good.");
}

main().catch((err) => fail(err?.message || String(err)));
