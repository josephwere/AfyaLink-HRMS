import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import mongoose from "mongoose";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import GovernmentStaff from "../models/GovernmentStaff.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import PharmacyItem from "../models/PharmacyItem.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";
import Ward from "../models/Ward.js";
import Bed from "../models/Bed.js";
import { HOSPITAL_SCOPED_ROLES, STAFF_ROLES } from "../utils/roleSets.js";
import { evaluateStaffIdentityChecklist } from "../utils/staffIdentityChecklist.js";

dotenv.config();

const CONFIRM = String(process.env.AFYALINK_PRESENTATION_SEED || "").toUpperCase();
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PASSWORD = process.env.AFYALINK_PRESENTATION_PASSWORD || "AfyaDemo@2026!";
const RESET_PASSWORDS = String(process.env.AFYALINK_PRESENTATION_RESET_PASSWORDS || "true").toLowerCase() !== "false";
const PRINT_PASSWORDS = String(process.env.AFYALINK_PRESENTATION_PRINT_PASSWORDS || "1").toLowerCase() !== "0";

const hospitalSeed = {
  name: "AfyaLink Demo Medical Center",
  code: "AFYA-DEMO-001",
  registrationNumber: "MOH-AFYA-DEMO-001",
  type: "PRIVATE",
  country: "KE",
  region: "Nairobi",
  city: "Nairobi",
  address: "Demo Road, Nairobi",
  contact: "+254700100100",
  lat: -1.286389,
  lng: 36.817223,
};

const roleLabel = (role) =>
  String(role || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const hospitalAccounts = [
  {
    role: "HOSPITAL_ADMIN",
    name: "Mary Wanjiku Hospital Admin",
    email: "hospital.admin@afyalink.demo",
    employeeId: "AFYA-HA-001",
    department: "Administration",
  },
  ...HOSPITAL_SCOPED_ROLES.filter((role) => role !== "HOSPITAL_ADMIN").map((role, index) => ({
    role,
    name:
      {
        HOSPITAL_ADMIN_ASSISTANT: "Peter Kariuki Admin Assistant",
        DOCTOR: "Dr Amina Otieno",
        SURGEON: "Dr Brian Mwangi",
        NURSE: "Grace Njeri Nurse",
        LAB_TECH: "Kevin Ochieng Lab Tech",
        PHARMACIST: "Faith Wambui Pharmacist",
        RADIOLOGIST: "Dr Sarah Chebet Radiologist",
        THERAPIST: "Lucy Achieng Therapist",
        RECEPTIONIST: "Janet Moraa Receptionist",
        SECURITY_OFFICER: "Samuel Kiptoo Security Officer",
        SECURITY_ADMIN: "Victor Onyango Security Admin",
        HR_MANAGER: "Eunice Muthoni HR Manager",
        PAYROLL_OFFICER: "Daniel Kimani Payroll Officer",
        COMMUNITY_HEALTH_WORKER: "Mercy Atieno Community Health Worker",
      }[role] || `${roleLabel(role)} Demo`,
    email: `${role.toLowerCase().replace(/_/g, ".")}@afyalink.demo`,
    employeeId: `AFYA-ST-${String(index + 1).padStart(3, "0")}`,
    department:
      {
        DOCTOR: "Outpatient",
        SURGEON: "Theatre",
        NURSE: "Nursing",
        LAB_TECH: "Laboratory",
        PHARMACIST: "Pharmacy",
        RADIOLOGIST: "Radiology",
        THERAPIST: "Rehabilitation",
        RECEPTIONIST: "Front Office",
        HR_MANAGER: "People Operations",
        PAYROLL_OFFICER: "Finance",
      }[role] || "Operations",
  })),
];

const governmentAccounts = [
  {
    role: "GOVERNMENT_ADMIN",
    name: "Agnes Moraa Government Admin",
    email: "government.admin@afyalink.demo",
    employeeId: "MOH-GOV-001",
    department: "Digital Health Administration",
    title: "Government Platform Administrator",
  },
  {
    role: "GOVERNMENT_REGULATOR",
    name: "Isaac Koech Regulator",
    email: "government.regulator@afyalink.demo",
    employeeId: "MOH-GOV-002",
    department: "Regulatory Oversight",
    title: "Health Services Regulator",
  },
  {
    role: "GOVERNMENT_AUDITOR",
    name: "Beatrice Nyambura Auditor",
    email: "government.auditor@afyalink.demo",
    employeeId: "MOH-GOV-003",
    department: "Audit",
    title: "Claims Auditor",
  },
  {
    role: "GOVERNMENT_INSPECTOR",
    name: "Patrick Langat Inspector",
    email: "government.inspector@afyalink.demo",
    employeeId: "MOH-GOV-004",
    department: "Inspections",
    title: "Hospital Inspector",
  },
  {
    role: "GOVERNMENT_ANALYST",
    name: "Naomi Akinyi Analyst",
    email: "government.analyst@afyalink.demo",
    employeeId: "MOH-GOV-005",
    department: "Analytics",
    title: "Health Data Analyst",
  },
];

const patientAccount = {
  role: "PATIENT",
  name: "John Barasa Patient",
  email: "patient.demo@afyalink.demo",
  phone: "+254700200200",
};

function phoneFor(index) {
  return `+2547001${String(index).padStart(5, "0")}`;
}

function nationalIdFor(index) {
  return `DEMO${String(index).padStart(6, "0")}`;
}

async function upsertUser(account, hospital = null, index = 0) {
  const email = String(account.email).toLowerCase();
  let user = await User.findOne({ email }).select("+password");
  if (!user) {
    user = new User({ email });
  }

  user.name = account.name;
  if (RESET_PASSWORDS || !user.password) user.password = PASSWORD;
  user.passwordSetAt = user.passwordSetAt || new Date();
  user.role = account.role;
  user.hospital = hospital?._id || null;
  user.phone = account.phone || phoneFor(index);
  user.emailVerified = true;
  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  user.phoneVerified = true;
  user.phoneVerifiedAt = user.phoneVerifiedAt || new Date();
  user.twoFactorEnabled = false;
  user.active = true;
  user.protectedAccount = ["SUPER_ADMIN", "SYSTEM_ADMIN", "GOVERNMENT_ADMIN"].includes(account.role);
  user.nationalIdNumber = account.nationalIdNumber || nationalIdFor(index);
  user.nationalIdCountry = "KE";
  user.licenseNumber = account.licenseNumber || `LIC-${account.role}-${String(index).padStart(3, "0")}`;
  user.licenseExpiry = account.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  user.employment = {
    ...(user.employment || {}),
    employeeId: account.employeeId || `AFYA-${account.role}-${index}`,
    department: account.department || "",
    status: HOSPITAL_SCOPED_ROLES.includes(account.role) ? "ACTIVE" : "INACTIVE",
    hireDate: user.employment?.hireDate || new Date(),
  };
  user.credentials = {
    ...(user.credentials || {}),
    specialization: account.specialization || roleLabel(account.role),
    certifications: ["AfyaLink presentation onboarding"],
    documents: [
      {
        name: "Presentation credential placeholder",
        url: "seed://presentation-credential",
        uploadedAt: new Date(),
      },
    ],
  };
  user.metadata = {
    ...(user.metadata || {}),
    demoAccount: true,
    presentationSeededAt: new Date().toISOString(),
  };

  await user.save();
  return user;
}

async function syncStaffProfile(user) {
  if (!STAFF_ROLES.includes(user.role)) return null;
  const checklist = evaluateStaffIdentityChecklist(user);
  return Staff.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        role: user.role,
        hospital: user.hospital,
        status: "ACTIVE",
        employeeId: user.employment?.employeeId || "",
        department: user.employment?.department || "",
        licenseNumber: user.licenseNumber || "",
        licenseExpiry: user.licenseExpiry || null,
        checklist: {
          compliant: checklist.compliant,
          completionRate: checklist.completionRate,
          missingKeys: checklist.missingKeys,
          missingLabels: checklist.missingLabels,
          evaluatedAt: new Date(),
        },
        metadata: { demoAccount: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function syncGovernmentProfile(user, account) {
  return GovernmentStaff.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        role: user.role,
        agency: "Ministry of Health",
        department: account.department,
        title: account.title,
        employeeId: account.employeeId,
        jurisdiction: {
          country: "KE",
          region: "Nairobi",
          county: "Nairobi",
        },
        status: "ACTIVE",
        metadata: { demoAccount: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function upsertHospital() {
  const registry = await GovernmentHospitalRegistry.findOneAndUpdate(
    { registrationNumber: hospitalSeed.registrationNumber },
    {
      $set: {
        officialName: hospitalSeed.name,
        aliases: ["AfyaLink Demo Hospital"],
        registrationNumber: hospitalSeed.registrationNumber,
        hospitalType: hospitalSeed.type,
        status: "ACTIVE",
        location: {
          country: hospitalSeed.country,
          region: hospitalSeed.region,
          city: hospitalSeed.city,
          address: hospitalSeed.address,
        },
        contact: {
          phone: hospitalSeed.contact,
          email: "demo.hospital@afyalink.demo",
        },
        approvedAt: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        source: { name: "Ministry of Health", referenceUrl: "" },
        metadata: { demoAccount: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Hospital.findOneAndUpdate(
    { code: hospitalSeed.code },
    {
      $set: {
        name: hospitalSeed.name,
        code: hospitalSeed.code,
        address: hospitalSeed.address,
        contact: hospitalSeed.contact,
        type: hospitalSeed.type,
        active: true,
        plan: "ENTERPRISE",
        limits: { users: 500, patients: 5000, storageMB: 10240 },
        location: {
          country: hospitalSeed.country,
          region: hospitalSeed.region,
          city: hospitalSeed.city,
          lat: hospitalSeed.lat,
          lng: hospitalSeed.lng,
        },
        verification: {
          status: "VERIFIED",
          registryHospital: registry._id,
          registrationNumber: hospitalSeed.registrationNumber,
          approvalDate: new Date(),
          verifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          nextReverificationAt: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
          source: "Ministry of Health",
          badgeLabel: "Government Approved",
          publicVisible: true,
          lastRegistryCheckAt: new Date(),
          lastRegistryCheckResult: "MATCHED",
          suspiciousSignals: [],
          reviewNotes: "",
        },
        subscription: {
          paid: true,
          status: "ACTIVE",
          trialStartedAt: new Date(),
          trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          premiumPaused: false,
          lastPaymentAt: new Date(),
          reminderTagsSent: ["presentation_seeded"],
        },
        features: {
          ai: true,
          payments: true,
          pharmacy: true,
          inventory: true,
          lab: true,
          realtime: true,
          auditLogs: true,
          adminCreation: true,
          advertising: true,
          recruitmentAds: true,
          advancedAnalytics: true,
          heavyExports: true,
        },
        metadata: { demoAccount: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedWardsAndBeds(hospital) {
  const wardSeeds = [
    { name: "Outpatient", type: "GENERAL", department: "OPD", capacity: 12, beds: ["OPD-01", "OPD-02"] },
    { name: "Laboratory Observation", type: "GENERAL", department: "Laboratory", capacity: 4, beds: ["LAB-01"] },
    { name: "Maternity", type: "MATERNITY", department: "Maternity", capacity: 8, beds: ["MAT-01", "MAT-02"] },
  ];

  const wards = [];
  for (const item of wardSeeds) {
    const ward = await Ward.findOneAndUpdate(
      { hospital: hospital._id, name: item.name },
      {
        $set: {
          hospital: hospital._id,
          name: item.name,
          code: item.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
          type: item.type,
          department: item.department,
          capacity: item.capacity,
          active: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    wards.push(ward);

    for (const bedNumber of item.beds) {
      await Bed.findOneAndUpdate(
        { hospital: hospital._id, ward: ward.name, number: bedNumber },
        {
          $set: {
            hospital: hospital._id,
            ward: ward.name,
            wardRef: ward._id,
            number: bedNumber,
            occupied: false,
            patient: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }
  return wards;
}

async function seedPharmacy(hospital) {
  const medicines = [
    { name: "Amoxicillin", sku: "MED-AMOX-500", strength: "500 mg", form: "Capsule", unit: "capsule", totalQuantity: 240, minStock: 50 },
    { name: "Paracetamol", sku: "MED-PARA-500", strength: "500 mg", form: "Tablet", unit: "tablet", totalQuantity: 600, minStock: 100 },
    { name: "Oral Rehydration Salts", sku: "MED-ORS", strength: "20.5 g", form: "Sachet", unit: "sachet", totalQuantity: 180, minStock: 40 },
    { name: "Ceftriaxone", sku: "MED-CEF-1G", strength: "1 g", form: "Vial", unit: "vial", totalQuantity: 60, minStock: 20 },
    { name: "Metformin", sku: "MED-METF-500", strength: "500 mg", form: "Tablet", unit: "tablet", totalQuantity: 320, minStock: 80 },
  ];

  for (const med of medicines) {
    await PharmacyItem.findOneAndUpdate(
      { hospital: hospital._id, sku: med.sku },
      {
        $set: {
          ...med,
          hospital: hospital._id,
          category: "medicine",
          active: true,
          description: `${med.name} ${med.strength} ${med.form}`,
          batches: [
            {
              batchNumber: `${med.sku}-B1`,
              expiryDate: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000),
              quantity: med.totalQuantity,
              costPrice: 10,
              sellingPrice: 20,
            },
          ],
        },
      },
    { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function seedPatient(hospital, doctor, wards) {
  const user = await upsertUser(patientAccount, null, 900);
  const ward = wards.find((row) => row.name === "Outpatient") || wards[0];
  const patient = await Patient.findOneAndUpdate(
    { "metadata.userId": user._id },
    {
      $set: {
        firstName: "John",
        lastName: "Barasa",
        dob: new Date("1990-04-15"),
        gender: "MALE",
        nationalId: "PRESENTATION-PATIENT-001",
        countryId: "SHA-DEMO-001",
        contact: patientAccount.phone,
        address: "Nairobi",
        hospital: hospital._id,
        primaryDoctor: doctor?._id || null,
        ward: ward?.name || "",
        wardRef: ward?._id || null,
        insurance: {
          provider: "SHA",
          policyNumber: "SHA-DEMO-001",
          metadata: { demoAccount: true },
        },
        identityVerification: {
          status: "VERIFIED",
          method: "NATIONAL_ID",
          registryMatch: true,
          lastCheckedAt: new Date(),
          verifiedAt: new Date(),
          immutable: false,
        },
        metadata: {
          userId: user._id,
          demoAccount: true,
        },
        active: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { user, patient };
}

export async function runPresentationSeed({
  manageConnection = true,
  requireConfirm = true,
  logger = console,
} = {}) {
  if (requireConfirm && CONFIRM !== "YES") {
    throw new Error("Refusing to seed presentation data. Set AFYALINK_PRESENTATION_SEED=YES to continue.");
  }
  if (manageConnection && !MONGO_URI) {
    throw new Error("Missing MONGO_URI or MONGODB_URI.");
  }
  if (!manageConnection && mongoose.connection.readyState !== 1) {
    throw new Error("Database must be connected before running presentation seed.");
  }

  let connectedHere = false;
  if (manageConnection) {
    await mongoose.connect(MONGO_URI, { autoIndex: true });
    connectedHere = true;
  }

  try {
    const hospital = await upsertHospital();

    const createdHospitalUsers = [];
    for (const [index, account] of hospitalAccounts.entries()) {
      const user = await upsertUser(account, hospital, index + 1);
      await syncStaffProfile(user);
      createdHospitalUsers.push(user);
    }

    const admin = createdHospitalUsers.find((user) => user.role === "HOSPITAL_ADMIN");
    if (admin) {
      hospital.admins = hospital.admins || [];
      if (!hospital.admins.some((id) => String(id) === String(admin._id))) {
        hospital.admins.push(admin._id);
        await hospital.save();
      }
    }

    const createdGovernmentUsers = [];
    for (const [index, account] of governmentAccounts.entries()) {
      const user = await upsertUser(account, null, index + 100);
      user.employment = {
        ...(user.employment || {}),
        employeeId: account.employeeId,
        department: account.department,
        status: "ACTIVE",
      };
      await user.save();
      await syncGovernmentProfile(user, account);
      createdGovernmentUsers.push(user);
    }

    const wards = await seedWardsAndBeds(hospital);
    await seedPharmacy(hospital);
    const doctor = createdHospitalUsers.find((user) => user.role === "DOCTOR");
    const { user: patientUser } = await seedPatient(hospital, doctor, wards);

    const accounts = [
      ...createdHospitalUsers,
      ...createdGovernmentUsers,
      patientUser,
    ].map((user) => ({
      name: user.name,
      role: user.role,
      email: user.email,
      ...(PRINT_PASSWORDS ? { password: PASSWORD } : {}),
    }));

    logger.log?.("\nAfyaLink presentation data is ready.\n");
    if (typeof logger.table === "function") logger.table(accounts);
    else logger.log?.(JSON.stringify(accounts, null, 2));
    logger.log?.("\nHospital:");
    logger.log?.({
      id: String(hospital._id),
      name: hospital.name,
      code: hospital.code,
      registrationNumber: hospital.verification?.registrationNumber,
      marketplaceVisible: hospital.active && hospital.verification?.status === "VERIFIED" && hospital.verification?.publicVisible,
    });
    logger.log?.("\nUse these accounts only for presentation/demo testing. Rotate or remove them before real production use.\n");

    return {
      hospital: {
        id: String(hospital._id),
        name: hospital.name,
        code: hospital.code,
        marketplaceVisible: hospital.active && hospital.verification?.status === "VERIFIED" && hospital.verification?.publicVisible,
      },
      accounts: accounts.map(({ password, ...account }) => account),
    };
  } finally {
    if (connectedHere) {
      await mongoose.connection.close().catch(() => {});
    }
  }
}

const isCliRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCliRun) {
  runPresentationSeed()
  .catch((error) => {
    console.error("Presentation seed failed:", error);
    process.exitCode = 1;
  });
}
