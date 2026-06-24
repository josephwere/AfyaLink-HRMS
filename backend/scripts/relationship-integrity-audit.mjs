import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Bed from "../models/Bed.js";
import Encounter from "../models/Encounter.js";
import GovernmentStaff, { GOVERNMENT_STAFF_ROLES } from "../models/GovernmentStaff.js";
import Hospital from "../models/Hospital.js";
import LabOrder from "../models/LabOrder.js";
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";
import Ward from "../models/Ward.js";
import { HOSPITAL_SCOPED_ROLES, STAFF_ROLES } from "../utils/roleSets.js";
import { evaluateStaffIdentityChecklist } from "../utils/staffIdentityChecklist.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const shouldFix = process.argv.includes("--fix") || process.env.AFYALINK_RELATIONSHIP_FIX === "1";

if (!mongoUri) {
  console.error("Missing MONGO_URI or MONGODB_URI.");
  process.exit(1);
}

const unique = (items) => [...new Set(items.filter(Boolean))].sort();
const asId = (value) => (value ? String(value) : "");

function readUserRoleEnum() {
  const userModel = fs.readFileSync(path.join(repoRoot, "backend", "models", "User.js"), "utf8");
  const enumBlock = userModel.match(/role:\s*{[\s\S]*?enum:\s*\[([\s\S]*?)\]/)?.[1] || "";
  return unique([...enumBlock.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]));
}

function readFrontendRouteRoles() {
  const appPath = path.join(repoRoot, "frontend", "src", "App.jsx");
  if (!fs.existsSync(appPath)) return [];
  const app = fs.readFileSync(appPath, "utf8");
  return unique(
    [...app.matchAll(/roles=\{\[([^\]]+)\]\}/g)].flatMap((match) =>
      [...match[1].matchAll(/"([A-Z_]+)"/g)].map((roleMatch) => roleMatch[1])
    )
  );
}

async function ensureWard({ hospital, name }) {
  const wardName = String(name || "").trim();
  if (!hospital || !wardName) return null;
  return Ward.findOneAndUpdate(
    { hospital, name: wardName },
    {
      $setOnInsert: {
        hospital,
        name: wardName,
        code: wardName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24),
        type: "GENERAL",
        active: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function syncStaffProfiles(report) {
  const staffUsers = await User.find({
    role: { $in: STAFF_ROLES },
    active: { $ne: false },
  }).lean();

  for (const user of staffUsers) {
    if (!user.hospital) {
      report.staffProfiles.missingHospital.push(user.email || asId(user._id));
      continue;
    }

    const exists = await Staff.exists({ user: user._id });
    if (!exists) report.staffProfiles.missingProfile.push(user.email || asId(user._id));

    if (shouldFix) {
      const checklist = evaluateStaffIdentityChecklist(user);
      await Staff.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            user: user._id,
            role: user.role,
            hospital: user.hospital,
            status: user?.employment?.status || "ACTIVE",
            employeeId: user?.employment?.employeeId || "",
            department: user?.employment?.department || "",
            licenseNumber: user?.licenseNumber || "",
            licenseExpiry: user?.licenseExpiry || null,
            checklist: {
              compliant: checklist.compliant,
              completionRate: checklist.completionRate,
              missingKeys: checklist.missingKeys,
              missingLabels: checklist.missingLabels,
              evaluatedAt: new Date(),
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }
}

async function syncGovernmentProfiles(report) {
  const govUsers = await User.find({
    role: { $in: GOVERNMENT_STAFF_ROLES },
    active: { $ne: false },
  }).lean();

  for (const user of govUsers) {
    const exists = await GovernmentStaff.exists({ user: user._id });
    if (!exists) report.governmentProfiles.missingProfile.push(user.email || asId(user._id));

    if (shouldFix) {
      await GovernmentStaff.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            user: user._id,
            role: user.role,
            agency: user?.metadata?.agency || "Ministry of Health",
            department: user?.employment?.department || "",
            employeeId: user?.employment?.employeeId || "",
            status: user.active === false ? "INACTIVE" : "ACTIVE",
            metadata: {
              ...(user.metadata || {}),
              relationshipAuditSyncedAt: new Date().toISOString(),
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }
}

async function syncHospitalAdmins(report) {
  const admins = await User.find({
    role: "HOSPITAL_ADMIN",
    hospital: { $ne: null },
    active: { $ne: false },
  }).select("_id email hospital").lean();

  for (const admin of admins) {
    const hospital = await Hospital.findById(admin.hospital).select("_id admins").lean();
    if (!hospital) {
      report.hospitalAdmins.missingHospital.push(admin.email || asId(admin._id));
      continue;
    }
    const linked = (hospital.admins || []).some((id) => asId(id) === asId(admin._id));
    if (!linked) report.hospitalAdmins.notInHospitalAdmins.push(admin.email || asId(admin._id));
    if (shouldFix && !linked) {
      await Hospital.updateOne({ _id: hospital._id }, { $addToSet: { admins: admin._id } });
    }
  }
}

async function syncWardRefs(report) {
  const beds = await Bed.find({
    $or: [{ wardRef: null }, { wardRef: { $exists: false } }],
    ward: { $nin: [null, ""] },
  }).select("_id hospital ward number").lean();

  for (const bed of beds) {
    report.wards.bedsMissingWardRef.push(`${bed.ward}/${bed.number}`);
    if (shouldFix) {
      const ward = await ensureWard({ hospital: bed.hospital, name: bed.ward });
      if (ward) await Bed.updateOne({ _id: bed._id }, { $set: { wardRef: ward._id, ward: ward.name } });
    }
  }

  const patients = await Patient.find({
    $or: [{ wardRef: null }, { wardRef: { $exists: false } }],
    ward: { $nin: [null, ""] },
  }).select("_id hospital ward firstName lastName").lean();

  for (const patient of patients) {
    report.wards.patientsMissingWardRef.push(
      `${[patient.firstName, patient.lastName].filter(Boolean).join(" ") || asId(patient._id)}:${patient.ward}`
    );
    if (shouldFix) {
      const ward = await ensureWard({ hospital: patient.hospital, name: patient.ward });
      if (ward) await Patient.updateOne({ _id: patient._id }, { $set: { wardRef: ward._id, ward: ward.name } });
    }
  }
}

async function syncClinicalLinks(report) {
  const prescriptions = await Prescription.find({
    $or: [{ patientRecord: null }, { patientRecord: { $exists: false } }],
    patient: { $ne: null },
  }).select("_id patient").lean();

  for (const row of prescriptions) {
    const patientRecord = await Patient.findOne({ "metadata.userId": row.patient }).select("_id").lean();
    if (!patientRecord) {
      report.clinical.prescriptionsWithoutPatientRecord.push(asId(row._id));
      continue;
    }
    if (shouldFix) {
      await Prescription.updateOne({ _id: row._id }, { $set: { patientRecord: patientRecord._id } });
    }
  }

  report.clinical.orphanAppointments = await Appointment.countDocuments({
    $or: [{ patient: null }, { hospital: null }, { createdBy: null }],
  });
  report.clinical.orphanEncounters = await Encounter.countDocuments({
    $or: [{ patient: null }, { doctor: null }, { hospital: null }],
  });
  report.clinical.orphanLabOrders = await LabOrder.countDocuments({
    $or: [{ encounter: null }, { patient: null }, { hospital: null }],
  });
}

async function run() {
  const userRoles = readUserRoleEnum();
  const frontendRoles = readFrontendRouteRoles();
  const roleSet = new Set(userRoles);

  const report = {
    mode: shouldFix ? "fix" : "audit",
    roleIntegrity: {
      userEnumRoles: userRoles,
      frontendRouteRoles: frontendRoles,
      frontendRolesMissingFromUserEnum: frontendRoles.filter((role) => !roleSet.has(role)),
      hospitalScopedRolesMissingFromUserEnum: HOSPITAL_SCOPED_ROLES.filter((role) => !roleSet.has(role)),
      staffRolesMissingFromUserEnum: STAFF_ROLES.filter((role) => !roleSet.has(role)),
      governmentRolesMissingFromUserEnum: GOVERNMENT_STAFF_ROLES.filter((role) => !roleSet.has(role)),
    },
    staffProfiles: { missingProfile: [], missingHospital: [] },
    governmentProfiles: { missingProfile: [] },
    hospitalAdmins: { notInHospitalAdmins: [], missingHospital: [] },
    wards: { bedsMissingWardRef: [], patientsMissingWardRef: [] },
    clinical: {
      prescriptionsWithoutPatientRecord: [],
      orphanAppointments: 0,
      orphanEncounters: 0,
      orphanLabOrders: 0,
    },
    counts: {},
  };

  await mongoose.connect(mongoUri, { autoIndex: false });
  await syncStaffProfiles(report);
  await syncGovernmentProfiles(report);
  await syncHospitalAdmins(report);
  await syncWardRefs(report);
  await syncClinicalLinks(report);

  report.counts = {
    users: await User.countDocuments(),
    hospitals: await Hospital.countDocuments(),
    patients: await Patient.countDocuments(),
    staffProfiles: await Staff.countDocuments(),
    governmentProfiles: await GovernmentStaff.countDocuments(),
    wards: await Ward.countDocuments(),
    beds: await Bed.countDocuments(),
    appointments: await Appointment.countDocuments(),
    encounters: await Encounter.countDocuments(),
    prescriptions: await Prescription.countDocuments(),
    labOrders: await LabOrder.countDocuments(),
  };

  console.log(JSON.stringify(report, null, 2));
}

run()
  .catch((error) => {
    console.error("Relationship integrity audit failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
