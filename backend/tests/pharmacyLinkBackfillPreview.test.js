import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";

let teardown;
let superAdminToken;
let hospitalAdminToken;

const signFor = (user) =>
  jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Preview Audit Hospital",
    code: "PREVIEW-AUDIT-HOSP",
    active: true,
  });

  const superAdmin = await User.create({
    name: "Preview Super Admin",
    email: "preview-super-admin@afya.test",
    password: "Pass123!",
    role: "SUPER_ADMIN",
    active: true,
    emailVerified: true,
  });
  superAdminToken = signFor(superAdmin);

  const hospitalAdmin = await User.create({
    name: "Preview Hospital Admin",
    email: "preview-hospital-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  hospitalAdminToken = signFor(hospitalAdmin);

  await RegisteredPharmacy.create({
    name: "Match Pharmacy",
    licenseNumber: "PREVIEW-MATCH-001",
    status: "ACTIVE",
    contact: { email: "match-pharmacy@afya.test", phone: "+254700100100" },
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  });

  await RegisteredPharmacy.create({
    name: "Ambiguous Pharmacy A",
    licenseNumber: "PREVIEW-AMB-001",
    status: "ACTIVE",
    contact: { email: "shared-contact@afya.test", phone: "+254700200200" },
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  });

  await RegisteredPharmacy.create({
    name: "Ambiguous Pharmacy B",
    licenseNumber: "PREVIEW-AMB-002",
    status: "ACTIVE",
    contact: { email: "shared-contact@afya.test", phone: "+254700300300" },
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  });

  await User.create({
    name: "Matched Pharmacist",
    email: "match-pharmacy@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  await User.create({
    name: "Ambiguous Pharmacist",
    email: "shared-contact@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  await User.create({
    name: "Skipped Pharmacist",
    email: "",
    phone: "",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Pharmacy link backfill preview", () => {
  test("blocks non-global admins from previewing backfill results", async () => {
    const res = await request(app)
      .get("/api/users/pharmacy-link-backfill-preview")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(res.status).toBe(403);
  });

  test("returns matched, ambiguous, and skipped preview rows for global admins", async () => {
    const res = await request(app)
      .get("/api/users/pharmacy-link-backfill-preview")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.scanned).toBe(3);
    expect(res.body.summary.matched).toBe(1);
    expect(res.body.summary.ambiguous).toBe(1);
    expect(res.body.summary.skipped).toBe(1);

    expect(res.body.matched[0]?.user?.name).toBe("Matched Pharmacist");
    expect(res.body.matched[0]?.pharmacy?.name).toBe("Match Pharmacy");
    expect(res.body.ambiguous[0]?.user?.name).toBe("Ambiguous Pharmacist");
    expect(res.body.ambiguous[0]?.candidates).toHaveLength(2);
    expect(res.body.skipped[0]?.user?.name).toBe("Skipped Pharmacist");
  });
});
