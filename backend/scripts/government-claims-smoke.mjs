import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

dotenv.config({ path: "backend/.env" });

const baseUrl = process.env.BASE_URL || "http://localhost:5000";
let token = process.env.GOV_DASHBOARD_TOKEN || process.env.ADMIN_TOKEN || "";
const smokeEmail = process.env.SMOKE_GOV_EMAIL || "smoke-gov-admin@afyalink.local";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (prefix) => {
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : "";
};

const modeFromFlag =
  getFlagValue("--mode=") ||
  (hasFlag("--inprocess") || hasFlag("-i") ? "inprocess" : "") ||
  (hasFlag("--live") || hasFlag("-l") ? "live" : "");

const modeFromEnv = String(process.env.SMOKE_MODE || "").toLowerCase();

const inProcess =
  modeFromFlag === "inprocess" ||
  (!modeFromFlag && (modeFromEnv === "inprocess" || process.env.SMOKE_INPROCESS === "1"));

let tempUserId = null;
let connected = false;

async function ensureToken() {
  if (token) return token;

  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!mongoUri) {
    console.error("Missing GOV_DASHBOARD_TOKEN and MONGO_URI is not set. Aborting.");
    process.exit(1);
  }
  if (!jwtSecret) {
    console.error("Missing GOV_DASHBOARD_TOKEN and JWT secret is not set. Aborting.");
    process.exit(1);
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
    connected = true;
  }

  let user = await User.findOne({ email: smokeEmail });
  if (!user) {
    user = await User.create({
      name: "Smoke Gov Admin",
      email: smokeEmail,
      role: "GOVERNMENT_ADMIN",
      authProvider: "google",
      active: true,
      emailVerified: true,
    });
    tempUserId = user._id;
  }

  token = jwt.sign({ id: String(user._id), twoFactorVerified: true }, jwtSecret, {
    expiresIn: "1h",
  });

  return token;
}

const endpoints = [
  "/api/government/overview",
  "/api/government/claims?limit=5",
  "/api/government/hospitals?limit=5",
  "/api/government/inspections?limit=5",
  "/api/government/enforcement?limit=5",
  "/api/government/health-funds?limit=5",
  "/api/government/notifications?limit=5",
  "/api/government/audit-logs?limit=5",
];

let failed = 0;

if (inProcess) {
  process.env.NODE_ENV = "test";
  process.env.DISABLE_BACKGROUND_JOBS = "1";
  const setup = (await import("../tests/setupTestEnv.js")).default;
  const teardown = await setup();
  await ensureToken();
  const app = (await import("../app.js")).default;
  const request = (await import("supertest")).default;

  for (const path of endpoints) {
    try {
      const res = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${token}`);

      if (res.status !== 200) {
        console.error(`[FAIL] ${path} -> ${res.status}\n${res.text}`);
        failed += 1;
        continue;
      }

      console.log(`[OK] ${path}`);
    } catch (err) {
      console.error(`[ERROR] ${path} -> ${err.message}`);
      failed += 1;
    }
  }

  if (tempUserId) await User.deleteOne({ _id: tempUserId });
  await teardown();
} else {
  await ensureToken();
  for (const path of endpoints) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[FAIL] ${path} -> ${res.status}\n${body}`);
        failed += 1;
        continue;
      }

      console.log(`[OK] ${path}`);
    } catch (err) {
      console.error(`[ERROR] ${path} -> ${err.message}`);
      failed += 1;
    }
  }
}

if (!inProcess && connected) {
  if (tempUserId) {
    await User.deleteOne({ _id: tempUserId });
  }
  await mongoose.disconnect();
}

if (failed > 0) {
  console.error(`Smoke test failed: ${failed} endpoint(s) failed.`);
  process.exit(1);
}

console.log("Government claims smoke test passed.");
