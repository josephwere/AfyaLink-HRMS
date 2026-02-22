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
  console.log("PASS production-preflight: env and database connectivity look good.");
}

main().catch((err) => fail(err?.message || String(err)));
