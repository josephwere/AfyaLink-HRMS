import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import AuditLog from "../models/AuditLog.js";

let teardown;
let adminToken;
let pharmacistId;
let pharmacyId;

const signFor = (user) =>
  jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({ name: "Audit Link Hospital", active: true });
  const admin = await User.create({
    name: "Audit Admin",
    email: "audit-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  const pharmacist = await User.create({
    name: "Audit Pharmacist",
    email: "audit-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });
  const pharmacy = await RegisteredPharmacy.create({
    name: "Audit Pharmacy",
    licenseNumber: "AUDIT-PHARM-001",
    status: "ACTIVE",
    createdBy: admin._id,
    updatedBy: admin._id,
  });

  adminToken = signFor(admin);
  pharmacistId = String(pharmacist._id);
  pharmacyId = String(pharmacy._id);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Pharmacist linkage audit", () => {
  test("emits PHARMACIST_LINKAGE_UPDATE when registered pharmacy changes", async () => {
    const res = await request(app)
      .patch(`/api/users/${pharmacistId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        role: "PHARMACIST",
        registeredPharmacy: pharmacyId,
      });

    expect(res.status).toBe(200);
    expect(String(res.body.registeredPharmacy)).toBe(pharmacyId);

    const audit = await AuditLog.findOne({
      action: "PHARMACIST_LINKAGE_UPDATE",
      resourceId: pharmacistId,
    })
      .sort({ createdAt: -1 })
      .lean();

    expect(audit).toBeTruthy();
    expect(audit?.before?.registeredPharmacy ?? null).toBe(null);
    expect(String(audit?.after?.registeredPharmacy)).toBe(pharmacyId);
    expect(audit?.metadata?.linked).toBe(true);
  });
});
