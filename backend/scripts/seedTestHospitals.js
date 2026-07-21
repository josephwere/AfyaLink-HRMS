// backend/scripts/seedTestHospitals.js
/**
 * Idempotent seed script for creating 5 test hospitals with verified users.
 *
 * Usage:
 *   node scripts/seedTestHospitals.js
 *   DEV_PASSWORD=MySecurePassword node scripts/seedTestHospitals.js
 *
 * Environment variables:
 *   DEV_PASSWORD: Development password for all seeded accounts (default: "Dev@1234Test!")
 *   MONGO_URI: MongoDB connection string
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import dotenv from "dotenv";

dotenv.config();

const DEV_PASSWORD = process.env.DEV_PASSWORD || "Dev@1234Test!";
const EXTERNAL_PHARMACY_PASSWORD = process.env.EXTERNAL_PHARMACY_PASSWORD || DEV_PASSWORD;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(SCRIPT_DIR, "..", "generated");
const BACKEND_ROOT = path.join(SCRIPT_DIR, "..");

function ensureGeneratedDirectory() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function writeJsonArtifact(filename, data) {
  fs.writeFileSync(path.join(GENERATED_DIR, filename), JSON.stringify(data, null, 2), "utf8");
}

function normalizeEmailForPharmacy(name) {
  return `pharmacist.${String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 50)}@test.afyalink.local`;
}

function normalizeNameForPharmacy(name) {
  return `Pharmacist ${String(name).trim()}`;
}

function formatMarkdownCell(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function buildSeedCredentialsMarkdown({ hospitals, users, pharmacies, defaultPassword }) {
  const hospitalUsersByCode = new Map();
  users.filter((user) => user.hospitalCode).forEach((user) => {
    const key = user.hospitalCode;
    if (!hospitalUsersByCode.has(key)) {
      hospitalUsersByCode.set(key, []);
    }
    hospitalUsersByCode.get(key).push(user);
  });

  const pharmacyUsersByName = new Map();
  users.filter((user) => user.pharmacyName).forEach((user) => {
    pharmacyUsersByName.set(user.pharmacyName, user);
  });

  const lines = [];
  lines.push("# Seed Credentials");
  lines.push("");

  for (const hospital of hospitals) {
    const hospitalUsers = hospitalUsersByCode.get(hospital.code) || [];
    lines.push(`## ${hospital.name}`);
    lines.push(`Code: **${hospital.code}**`);
    lines.push(`Location: **${formatMarkdownCell(hospital.city || "")}${hospital.county ? `, ${formatMarkdownCell(hospital.county)}` : ""}**`);
    if (hospital.hospitalId) {
      lines.push(`Hospital ID: **${hospital.hospitalId}**`);
    }
    lines.push("");
    if (hospital.county || hospital.city || hospital.region) {
      lines.push("Location:");
      if (hospital.county) lines.push(`- ${formatMarkdownCell(hospital.county)}`);
      if (hospital.city) lines.push(`- ${formatMarkdownCell(hospital.city)}`);
      if (hospital.region) lines.push(`- ${formatMarkdownCell(hospital.region)}`);
      lines.push("");
    }
    lines.push("Shared Password:");
    lines.push("");
    lines.push("```");
    lines.push(defaultPassword);
    lines.push("```");
    lines.push("");
    lines.push("| User ID | Role | Name | Email | Password |");
    lines.push("|---------|------|------|-------|----------|");
    for (const user of hospitalUsers) {
      lines.push(
        `| ${formatMarkdownCell(user.userId || "")} | ${formatMarkdownCell(user.role)} | ${formatMarkdownCell(user.name)} | [${user.email}](mailto:${user.email}) | ${defaultPassword} |`
      );
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("# Verified External Pharmacies");
  lines.push("");
  lines.push("| Pharmacy | Pharmacy ID | User ID | City | Region | Pharmacist Email | Password |");
  lines.push("|---------|------------|---------|------|--------|------------------|----------|");
  for (const pharmacy of pharmacies) {
    const pharmacyUser = pharmacyUsersByName.get(pharmacy.name);
    lines.push(
      `| ${formatMarkdownCell(pharmacy.name)} | ${formatMarkdownCell(pharmacy.pharmacyId || "")} | ${formatMarkdownCell(pharmacyUser?.userId || "")} | ${formatMarkdownCell(pharmacy.city)} | ${formatMarkdownCell(pharmacy.region)} | [${pharmacyUser?.email || pharmacy.contactEmail}](mailto:${pharmacyUser?.email || pharmacy.contactEmail}) | ${defaultPassword} |`
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("# Summary");
  lines.push("");
  lines.push(`Item Count`);
  lines.push("");
  lines.push(`- Hospitals: ${hospitals.length}`);
  lines.push(`- Hospital Users: ${users.filter((user) => user.hospitalCode).length}`);
  lines.push(`- External Pharmacy Users: ${users.filter((user) => user.pharmacyName).length}`);
  lines.push(`- Verified Pharmacies: ${pharmacies.length}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Hospital definitions with location and county information
 */
const HOSPITALS = [
  {
    name: "Nairobi Central Medical Centre",
    code: "NCMC",
    city: "Nairobi",
    county: "Nairobi",
    region: "Nairobi Metropolitan",
    type: "PRIVATE",
    latitude: -1.2921,
    longitude: 36.8219,
    address: "Nairobi Central District, Nairobi 00100, Kenya",
    phone: "+254 20 4445000",
    email: "info@ncmc.health.ke",
    website: "https://ncmc.health.ke",
  },
  {
    name: "Kiambu Regional Hospital",
    code: "KRH",
    city: "Kiambu",
    county: "Kiambu",
    region: "Central Kenya",
    type: "PUBLIC",
    latitude: -1.2679,
    longitude: 36.8136,
    address: "Kiambu Town, Kiambu 00900, Kenya",
    phone: "+254 20 3301000",
    email: "info@krh.health.ke",
    website: "https://krh.health.ke",
  },
  {
    name: "Machakos Community Hospital",
    code: "MCH",
    city: "Machakos",
    county: "Machakos",
    region: "Eastern Kenya",
    type: "PUBLIC",
    latitude: -2.7208,
    longitude: 37.2636,
    address: "Machakos Town, Machakos 90100, Kenya",
    phone: "+254 45 2222000",
    email: "info@mch.health.ke",
    website: "https://mch.health.ke",
  },
  {
    name: "Kisumu Lakeside Hospital",
    code: "KLH",
    city: "Kisumu",
    county: "Kisumu",
    region: "Western Kenya",
    type: "PRIVATE",
    latitude: -0.1022,
    longitude: 34.7617,
    address: "Kisumu Central District, Kisumu 40100, Kenya",
    phone: "+254 57 2030000",
    email: "info@klh.health.ke",
    website: "https://klh.health.ke",
  },
  {
    name: "Eldoret Highlands Medical Centre",
    code: "EHMC",
    city: "Eldoret",
    county: "Uasin Gishu",
    region: "Rift Valley",
    type: "PRIVATE",
    latitude: 0.5143,
    longitude: 35.2698,
    address: "Eldoret Town, Eldoret 30100, Kenya",
    phone: "+254 53 2030000",
    email: "info@ehmc.health.ke",
    website: "https://ehmc.health.ke",
  },
];

/**
 * Role definitions with count (default 1 per role, 2 for doctors and nurses)
 */
const ROLE_TEMPLATES = [
  { role: "HOSPITAL_ADMIN", count: 1, prefix: "admin" },
  { role: "DOCTOR", count: 2, prefix: "doctor" },
  { role: "NURSE", count: 2, prefix: "nurse" },
  { role: "RECEPTIONIST", count: 1, prefix: "reception" },
  { role: "PHARMACIST", count: 1, prefix: "pharmacist" },
  { role: "LAB_TECH", count: 1, prefix: "labtech" },
  { role: "HR_MANAGER", count: 1, prefix: "hr" },
  { role: "PAYROLL_OFFICER", count: 1, prefix: "accountant" },
];

/**
 * Realistic Kenyan names for staff by role and hospital
 */
const STAFF_NAMES = {
  NCMC: {
    HOSPITAL_ADMIN: [{ firstName: "James", lastName: "Mwangi" }],
    DOCTOR: [
      { firstName: "Dr. Grace", lastName: "Wanjiku" },
      { firstName: "Dr. Brian", lastName: "Otieno" },
    ],
    NURSE: [
      { firstName: "Mercy", lastName: "Achieng" },
      { firstName: "Esther", lastName: "Njeri" },
    ],
    RECEPTIONIST: [{ firstName: "Lucy", lastName: "Mutiso" }],
    PHARMACIST: [{ firstName: "Peter", lastName: "Kiptoo" }],
    LAB_TECH: [{ firstName: "Kelvin", lastName: "Ouma" }],
    HR_MANAGER: [{ firstName: "Faith", lastName: "Wambui" }],
    PAYROLL_OFFICER: [{ firstName: "Samuel", lastName: "Kibet" }],
  },
  KRH: {
    HOSPITAL_ADMIN: [{ firstName: "Alice", lastName: "Njoroge" }],
    DOCTOR: [
      { firstName: "Dr. Michael", lastName: "Mutua" },
      { firstName: "Dr. Jane", lastName: "Kariuki" },
    ],
    NURSE: [
      { firstName: "Ruth", lastName: "Mwikali" },
      { firstName: "Joyce", lastName: "Kamau" },
    ],
    RECEPTIONIST: [{ firstName: "Estella", lastName: "Ndungu" }],
    PHARMACIST: [{ firstName: "David", lastName: "Muriithi" }],
    LAB_TECH: [{ firstName: "Peter", lastName: "Wanyama" }],
    HR_MANAGER: [{ firstName: "Jane", lastName: "Wachira" }],
    PAYROLL_OFFICER: [{ firstName: "Dennis", lastName: "Njuguna" }],
  },
  MCH: {
    HOSPITAL_ADMIN: [{ firstName: "Joseph", lastName: "Kamande" }],
    DOCTOR: [
      { firstName: "Dr. Cynthia", lastName: "Wakio" },
      { firstName: "Dr. Samuel", lastName: "Mwangi" },
    ],
    NURSE: [
      { firstName: "Anne", lastName: "Njeri" },
      { firstName: "Caroline", lastName: "Wairimu" },
    ],
    RECEPTIONIST: [{ firstName: "Anne", lastName: "Muthoni" }],
    PHARMACIST: [{ firstName: "Kevin", lastName: "Kimani" }],
    LAB_TECH: [{ firstName: "Nancy", lastName: "Murithi" }],
    HR_MANAGER: [{ firstName: "Grace", lastName: "Kabiru" }],
    PAYROLL_OFFICER: [{ firstName: "Fred", lastName: "Wambua" }],
  },
  KLH: {
    HOSPITAL_ADMIN: [{ firstName: "Stephen", lastName: "Ochieng" }],
    DOCTOR: [
      { firstName: "Dr. Lydia", lastName: "Adera" },
      { firstName: "Dr. Joseph", lastName: "Odhiambo" },
    ],
    NURSE: [
      { firstName: "Grace", lastName: "Akinyi" },
      { firstName: "Mercy", lastName: "Atieno" },
    ],
    RECEPTIONIST: [{ firstName: "Martha", lastName: "Ouma" }],
    PHARMACIST: [{ firstName: "Brian", lastName: "Oketch" }],
    LAB_TECH: [{ firstName: "Daniel", lastName: "Omondi" }],
    HR_MANAGER: [{ firstName: "Joy", lastName: "Akinyi" }],
    PAYROLL_OFFICER: [{ firstName: "Eric", lastName: "Otieno" }],
  },
  EHMC: {
    HOSPITAL_ADMIN: [{ firstName: "Maria", lastName: "Cheruiyot" }],
    DOCTOR: [
      { firstName: "Dr. Dennis", lastName: "Korir" },
      { firstName: "Dr. Jane", lastName: "Ngeno" },
    ],
    NURSE: [
      { firstName: "Patricia", lastName: "Chepchumba" },
      { firstName: "Ruth", lastName: "Kiptoo" },
    ],
    RECEPTIONIST: [{ firstName: "Esther", lastName: "Wanjiru" }],
    PHARMACIST: [{ firstName: "James", lastName: "Koech" }],
    LAB_TECH: [{ firstName: "Peter", lastName: "Kimutai" }],
    HR_MANAGER: [{ firstName: "Mercy", lastName: "Jeptoo" }],
    PAYROLL_OFFICER: [{ firstName: "Patrick", lastName: "Kimutai" }],
  },
};

const EXTERNAL_PHARMACIES = [
  {
    name: "Nairobi Government Pharmacy",
    licenseNumber: "GOV-PHARM-001",
    governmentRegistryId: "GOV-REG-001",
    status: "ACTIVE",
    contact: { phone: "+254 20 5001000", email: "contact@nairobi.govpharmacy.ke" },
    location: {
      country: "Kenya",
      region: "Nairobi Metropolitan",
      city: "Nairobi",
      address: "Government Health Plaza, Nairobi 00100, Kenya",
      lat: -1.2833,
      lng: 36.8167,
    },
    services: ["Dispensing", "Delivery", "Consultation"],
  },
  {
    name: "Kiambu Public Pharmacy",
    licenseNumber: "GOV-PHARM-002",
    governmentRegistryId: "GOV-REG-002",
    status: "ACTIVE",
    contact: { phone: "+254 20 5002000", email: "contact@kiambu.govpharmacy.ke" },
    location: {
      country: "Kenya",
      region: "Central Kenya",
      city: "Kiambu",
      address: "County Health Complex, Kiambu 00900, Kenya",
      lat: -1.1667,
      lng: 36.8333,
    },
    services: ["Dispensing", "Telepharmacy"],
  },
  {
    name: "Machakos Regional Pharmacy",
    licenseNumber: "GOV-PHARM-003",
    governmentRegistryId: "GOV-REG-003",
    status: "ACTIVE",
    contact: { phone: "+254 45 5003000", email: "contact@machakos.govpharmacy.ke" },
    location: {
      country: "Kenya",
      region: "Eastern Kenya",
      city: "Machakos",
      address: "Regional Health Centre, Machakos 90100, Kenya",
      lat: -1.5167,
      lng: 37.2667,
    },
    services: ["Dispensing", "Emergency Pickup"],
  },
  {
    name: "Kisumu Central Government Pharmacy",
    licenseNumber: "GOV-PHARM-004",
    governmentRegistryId: "GOV-REG-004",
    status: "ACTIVE",
    contact: { phone: "+254 57 5004000", email: "contact@kisumu.govpharmacy.ke" },
    location: {
      country: "Kenya",
      region: "Western Kenya",
      city: "Kisumu",
      address: "Health Services Hub, Kisumu 40100, Kenya",
      lat: -0.0917,
      lng: 34.7680,
    },
    services: ["Dispensing", "Counseling"],
  },
  {
    name: "Eldoret Public Pharmacy",
    licenseNumber: "GOV-PHARM-005",
    governmentRegistryId: "GOV-REG-005",
    status: "ACTIVE",
    contact: { phone: "+254 53 5005000", email: "contact@eldoret.govpharmacy.ke" },
    location: {
      country: "Kenya",
      region: "Rift Valley",
      city: "Eldoret",
      address: "County Medical Centre, Eldoret 30100, Kenya",
      lat: 0.5167,
      lng: 35.2833,
    },
    services: ["Dispensing", "Delivery"],
  },
];

/**
 * Create or update users for a hospital
 */
async function seedUsersForHospital(hospital, cityName) {
  const hashedPassword = await bcrypt.hash(DEV_PASSWORD, 12);
  const createdUsers = [];
  const hospitalStaff = STAFF_NAMES[hospital.code] || {};

  for (const roleTemplate of ROLE_TEMPLATES) {
    const names = hospitalStaff[roleTemplate.role] || [];

    for (let i = 0; i < roleTemplate.count; i++) {
      const nameInfo = names[i] || { firstName: roleTemplate.prefix, lastName: "User" };
      const firstName = nameInfo.firstName.toLowerCase().replace(/\s+/g, "");
      const lastName = nameInfo.lastName.toLowerCase().replace(/\s+/g, "");
      const email = `${firstName}.${lastName}.${cityName.toLowerCase()}@test.afyalink.local`;
      const name = `${nameInfo.firstName} ${nameInfo.lastName}`;

      try {
        const user = await User.findOneAndUpdate(
          { email },
          {
            $set: {
              name,
              email,
              password: hashedPassword,
              role: roleTemplate.role,
              hospital: hospital._id,
              active: true,
              emailVerified: true,
              emailVerifiedAt: new Date(),
              phoneVerified: true,
              phoneVerifiedAt: new Date(),
              authProvider: "local",
              authMethods: ["local"],
            },
          },
          { upsert: true, new: true }
        );

        createdUsers.push({
          userId: user.userId,
          email: user.email,
          role: user.role,
          name: user.name,
          hospitalCode: hospital.code,
          hospitalName: hospital.name,
          city: cityName,
          county: hospital.metadata?.county || null,
          region: hospital.metadata?.region || null,
        });
      } catch (err) {
        console.error(`  ⚠️  Failed to create user ${email}:`, err.message);
      }
    }
  }

  return createdUsers;
}

/**
 * Create or update or verify a hospital entry
 */
async function seedHospital(hospitalDef) {
  const code = hospitalDef.code?.toUpperCase().trim();
  const address = hospitalDef.address || `${hospitalDef.city}, ${hospitalDef.county}`;

  const existing = await Hospital.findOne({ code });
  const hospital = await Hospital.findOneAndUpdate(
    { code },
    {
      $set: {
        name: hospitalDef.name,
        code,
        address,
        type: hospitalDef.type,
        active: true,
        contact: hospitalDef.phone || "",
        "verification.status": "VERIFIED",
        "verification.verifiedAt": new Date(),
        "subscription.status": "TRIAL",
        "features.pharmacy": true,
        "features.inventory": true,
        "features.lab": true,
        "features.realtime": true,
        "features.auditLogs": true,
        metadata: {
          ...(existing?.metadata || {}),
          latitude: hospitalDef.latitude || null,
          longitude: hospitalDef.longitude || null,
          phoneNumber: hospitalDef.phone || "",
          email: hospitalDef.email || "",
          website: hospitalDef.website || "",
          county: hospitalDef.county,
          region: hospitalDef.region,
        },
      },
    },
    { upsert: true, new: true }
  );

  return hospital;
}

/**
 * Create or update verified external pharmacies
 */
async function seedExternalPharmacyUser(pharmacy, allResults) {
  const hashedPassword = await bcrypt.hash(EXTERNAL_PHARMACY_PASSWORD, 12);
  const email = pharmacy.contact?.email
    ? pharmacy.contact.email.toLowerCase().replace(/[^a-z0-9@.]/g, ".")
    : normalizeEmailForPharmacy(pharmacy.name);
  const userName = normalizeNameForPharmacy(pharmacy.name);

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: userName,
        email,
        password: hashedPassword,
        role: "PHARMACIST",
        hospital: null,
        registeredPharmacy: pharmacy._id,
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        authProvider: "local",
        authMethods: ["local"],
        employment: {
          employeeId: `PHARM-${pharmacy.licenseNumber}`,
          department: "Pharmacy",
          status: "ACTIVE",
        },
      },
    },
    { upsert: true, new: true }
  );

  allResults.users.push({
    userId: user.userId,
    email: user.email,
    role: user.role,
    name: user.name,
    pharmacy: pharmacy._id,
    pharmacyName: pharmacy.name,
    pharmacyCity: pharmacy.location?.city || null,
    pharmacyRegion: pharmacy.location?.region || null,
    pharmacyContactEmail: pharmacy.contact?.email || email,
  });

  return user;
}

async function seedExternalPharmacies(allResults) {
  for (const pharmacyDef of EXTERNAL_PHARMACIES) {
    try {
      const pharmacy = await RegisteredPharmacy.findOneAndUpdate(
        { licenseNumber: pharmacyDef.licenseNumber },
        {
          $set: {
            name: pharmacyDef.name,
            licenseNumber: pharmacyDef.licenseNumber,
            governmentRegistryId: pharmacyDef.governmentRegistryId,
            status: pharmacyDef.status,
            contact: pharmacyDef.contact,
            location: pharmacyDef.location,
            services: pharmacyDef.services,
            createdBy: null,
            updatedBy: null,
          },
        },
        { upsert: true, new: true }
      );

      const pharmacyUser = await seedExternalPharmacyUser(pharmacy, allResults);
      allResults.pharmacies.push({
        pharmacyId: pharmacy.pharmacyId,
        name: pharmacy.name,
        licenseNumber: pharmacy.licenseNumber,
        id: pharmacy._id,
        city: pharmacy.location?.city || null,
        region: pharmacy.location?.region || null,
        contactEmail: pharmacy.contact?.email || null,
      });
      console.log(`   ✅ External pharmacy verified: ${pharmacy.name}`);
      console.log(`   ✅ External pharmacy user ready: ${pharmacyUser.email}`);
    } catch (err) {
      console.error(`   ❌ External pharmacy failed: ${pharmacyDef.name}:`, err.message);
    }
  }
}

/**
 * Main seed function
 */
export async function runTestHospitalsSeed({ manageConnection = true, logger = console } = {}) {
  let connectedHere = false;
  try {
    logger.log("\n🌱 Starting hospital seed...\n");

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("❌ MONGO_URI not set in environment");
    }

    if (manageConnection) {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      connectedHere = true;
    } else if (mongoose.connection.readyState !== 1) {
      throw new Error("Database must be connected before running test hospital seed.");
    }

    logger.log("✅ Connected to MongoDB\n");

    const allResults = {
      hospitals: [],
      users: [],
      pharmacies: [],
    };

    for (const hospitalDef of HOSPITALS) {
      logger.log(`🏥 Processing: ${hospitalDef.name}`);

      try {
        const hospital = await seedHospital(hospitalDef);
        logger.log(`   ✅ Hospital verified: ${hospital._id}`);

        const users = await seedUsersForHospital(hospital, hospitalDef.city);
        logger.log(`   ✅ Created/updated ${users.length} users`);

        allResults.hospitals.push({
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          code: hospital.code,
          id: hospital._id,
          userCount: users.length,
          city: hospital.metadata?.city || hospitalDef.city || null,
          county: hospital.metadata?.county || hospitalDef.county || null,
          region: hospital.metadata?.region || hospitalDef.region || null,
        });
        allResults.users.push(...users);
      } catch (err) {
        logger.error(`   ❌ Error processing ${hospitalDef.name}:`, err.message);
      }

      logger.log();
    }

    logger.log("\n⛑️ Seeding external pharmacies...\n");
    await seedExternalPharmacies(allResults);

    logger.log("\n📊 Seed Summary:");
    logger.log(`   Hospitals: ${allResults.hospitals.length}`);
    logger.log(`   Users: ${allResults.users.length}`);
    logger.log(`   External Pharmacies: ${allResults.pharmacies.length}`);
    logger.log("\n💡 Sample login credentials:");
    logger.log("   Email: grace.wanjiku.nairobi@test.afyalink.local");
    logger.log("   Password: (configured via DEV_PASSWORD environment variable)");

    const credentials = {
      hospitals: allResults.hospitals,
      users: allResults.users,
      pharmacies: allResults.pharmacies,
      defaultPassword: process.env.DEV_PASSWORD || DEV_PASSWORD,
    };
    ensureGeneratedDirectory();
    writeJsonArtifact("seed-credentials.json", credentials);
    writeJsonArtifact("hospitals.json", allResults.hospitals);
    writeJsonArtifact("users.json", allResults.users);
    writeJsonArtifact("pharmacies.json", allResults.pharmacies);
    const credentialsRootJson = path.join(BACKEND_ROOT, "seed-credentials.json");
    const credentialsRootMarkdown = path.join(BACKEND_ROOT, "SEED_CREDENTIALS.md");
    fs.writeFileSync(credentialsRootJson, JSON.stringify(credentials, null, 2), "utf8");
    fs.writeFileSync(credentialsRootMarkdown, buildSeedCredentialsMarkdown(credentials), "utf8");
    fs.writeFileSync(path.join(GENERATED_DIR, "seed-credentials.md"), buildSeedCredentialsMarkdown(credentials), "utf8");
    logger.log(`\n📄 Saved generated credentials artifacts to ${path.relative(process.cwd(), GENERATED_DIR)} and ${path.relative(process.cwd(), BACKEND_ROOT)}`);
    logger.log("\n✅ Seeding complete!\n");

    return credentials;
  } catch (err) {
    logger.error("❌ Seed failed:", err.message);
    logger.error(err.stack);
    throw err;
  } finally {
    if (connectedHere) {
      await mongoose.connection.close();
    }
  }
}

const isCliRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCliRun) {
  runTestHospitalsSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Test hospital seed failed:", error);
      process.exit(1);
    });
}
