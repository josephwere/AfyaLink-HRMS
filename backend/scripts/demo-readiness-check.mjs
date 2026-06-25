import "../config/loadEnv.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PASSWORD = process.env.AFYALINK_PRESENTATION_PASSWORD || "AfyaDemo@2026!";

const DEMO_EMAILS = [
  "hospital.admin@afyalink.demo",
  "hospital.admin.assistant@afyalink.demo",
  "doctor@afyalink.demo",
  "surgeon@afyalink.demo",
  "nurse@afyalink.demo",
  "lab.tech@afyalink.demo",
  "pharmacist@afyalink.demo",
  "radiologist@afyalink.demo",
  "therapist@afyalink.demo",
  "receptionist@afyalink.demo",
  "security.officer@afyalink.demo",
  "security.admin@afyalink.demo",
  "hr.manager@afyalink.demo",
  "payroll.officer@afyalink.demo",
  "community.health.worker@afyalink.demo",
  "government.admin@afyalink.demo",
  "government.regulator@afyalink.demo",
  "government.auditor@afyalink.demo",
  "government.inspector@afyalink.demo",
  "government.analyst@afyalink.demo",
  "patient.demo@afyalink.demo",
];

if (!MONGO_URI) {
  console.error("Missing MONGO_URI or MONGODB_URI.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI, { autoIndex: false });

const accounts = [];
for (const email of DEMO_EMAILS) {
  const user = await User.findOne({ email }).select("+password").lean();
  accounts.push({
    email,
    exists: Boolean(user),
    role: user?.role || null,
    active: user?.active ?? null,
    authProvider: user?.authProvider || null,
    hasPassword: Boolean(user?.password),
    passwordMatches: user?.password ? await bcrypt.compare(PASSWORD, user.password) : false,
    hospitalLinked: Boolean(user?.hospital),
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
  });
}

const demoHospital = await Hospital.findOne({ code: "AFYA-DEMO-001" }).lean();
const marketplaceMatch = await Hospital.findOne({
  code: "AFYA-DEMO-001",
  active: true,
  "verification.status": "VERIFIED",
  "verification.publicVisible": true,
}).lean();

const report = {
  ok:
    accounts.every((row) => row.exists && row.active !== false && row.passwordMatches) &&
    Boolean(marketplaceMatch),
  accounts,
  missingAccounts: accounts.filter((row) => !row.exists).map((row) => row.email),
  passwordMismatchAccounts: accounts
    .filter((row) => row.exists && !row.passwordMatches)
    .map((row) => row.email),
  inactiveAccounts: accounts
    .filter((row) => row.exists && row.active === false)
    .map((row) => row.email),
  demoHospital: demoHospital
    ? {
        exists: true,
        name: demoHospital.name,
        code: demoHospital.code,
        active: demoHospital.active,
        verificationStatus: demoHospital.verification?.status || null,
        publicVisible: demoHospital.verification?.publicVisible ?? null,
        marketplaceMatch: Boolean(marketplaceMatch),
        location: demoHospital.location || {},
      }
    : { exists: false, marketplaceMatch: false },
};

console.log(JSON.stringify(report, null, 2));
await mongoose.connection.close().catch(() => {});

if (!report.ok) {
  process.exitCode = 1;
}
