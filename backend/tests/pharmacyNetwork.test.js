import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import PharmacyReferral from "../models/PharmacyReferral.js";
import AuditLog from "../models/AuditLog.js";

let teardown;
let hospitalId;
let doctorToken;
let pharmacistToken;
let otherPharmacistToken;
let patientUserId;
let patientRecordId;
let pharmacyId;
let otherPharmacyId;

const signFor = (user) =>
  jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({ name: "Referral Scope Hospital", active: true });
  hospitalId = String(hospital._id);

  const doctor = await User.create({
    name: "Referral Doctor",
    email: "doctor-referral@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });

  const pharmacist = await User.create({
    name: "Scoped Pharmacist",
    email: "scoped-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  const otherPharmacist = await User.create({
    name: "Other Pharmacist",
    email: "other-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  const patientUser = await User.create({
    name: "Referral Patient",
    email: "patient-referral@afya.test",
    password: "Pass123!",
    role: "PATIENT",
    hospital: hospital._id,
    active: true,
  });
  patientUserId = String(patientUser._id);

  const patientRecord = await Patient.create({
    firstName: "Referral",
    lastName: "Patient",
    hospital: hospital._id,
    metadata: { userId: patientUser._id },
  });
  patientRecordId = String(patientRecord._id);

  const pharmacy = await RegisteredPharmacy.create({
    name: "Scoped Pharmacy",
    licenseNumber: "PHARM-SCOPED-001",
    status: "ACTIVE",
    contact: { email: "scoped-pharmacy@afya.test", phone: "+254700100100" },
    createdBy: doctor._id,
    updatedBy: doctor._id,
  });
  pharmacyId = String(pharmacy._id);

  const otherPharmacy = await RegisteredPharmacy.create({
    name: "Other Pharmacy",
    licenseNumber: "PHARM-SCOPED-002",
    status: "ACTIVE",
    contact: { email: "other-pharmacy@afya.test", phone: "+254700200200" },
    createdBy: doctor._id,
    updatedBy: doctor._id,
  });
  otherPharmacyId = String(otherPharmacy._id);

  pharmacist.registeredPharmacy = pharmacy._id;
  await pharmacist.save();

  otherPharmacist.registeredPharmacy = otherPharmacy._id;
  await otherPharmacist.save();

  doctorToken = signFor(doctor);
  pharmacistToken = signFor(pharmacist);
  otherPharmacistToken = signFor(otherPharmacist);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Pharmacy referral scoping", () => {
  let referralId;

  test("doctor creates patient-linked referral with audit and notification", async () => {
    const res = await request(app)
      .post("/api/pharmacy-network/referrals")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        pharmacyId,
        patientName: "Referral Patient",
        patientUser: patientUserId,
        patientRecord: patientRecordId,
        reason: "Medicine unavailable in hospital stock",
        medicationNotes: "Amoxicillin 500mg x 5 days",
        urgent: true,
      });

    expect(res.status).toBe(201);
    expect(String(res.body.referral.patientUser)).toBe(patientUserId);
    expect(String(res.body.referral.patientRecord)).toBe(patientRecordId);
    referralId = String(res.body.referral._id);

    const audit = await AuditLog.findOne({
      action: "PHARMACY_REFERRAL_CREATE",
      resourceId: res.body.referral._id,
    }).lean();
    expect(String(audit?.metadata?.pharmacyId)).toBe(pharmacyId);
  });

  test("doctor can direct a referral to the hospital pharmacy when no external pharmacy is chosen", async () => {
    const res = await request(app)
      .post("/api/pharmacy-network/referrals")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        pharmacyId: "__hospital__",
        patientName: "Referral Patient",
        patientUser: patientUserId,
        patientRecord: patientRecordId,
        reason: "Hospital pharmacy preferred",
        medicationNotes: "Amoxicillin 500mg x 5 days",
      });

    expect(res.status).toBe(201);
    expect(res.body.referral?.pharmacy).toBeDefined();
    const pharmacy = await RegisteredPharmacy.findById(res.body.referral.pharmacy).lean();
    expect(pharmacy?.name).toMatch(/hospital/i);
  });

  test("linked pharmacist only sees referrals for assigned pharmacy", async () => {
    const res = await request(app)
      .get("/api/pharmacy-network/referrals?limit=50")
      .set("Authorization", `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(String(res.body.items[0].pharmacy._id || res.body.items[0].pharmacy)).toBe(pharmacyId);
  });

  test("linked pharmacist cannot request another pharmacy scope", async () => {
    const res = await request(app)
      .get(`/api/pharmacy-network/referrals?pharmacyId=${otherPharmacyId}`)
      .set("Authorization", `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(403);
  });

  test("linked pharmacist cannot update another pharmacy referral", async () => {
    const foreignReferral = await PharmacyReferral.create({
      hospital: hospitalId,
      pharmacy: otherPharmacyId,
      patientName: "Foreign Patient",
      reason: "External referral",
      createdBy: patientUserId,
      updatedBy: patientUserId,
    });

    const res = await request(app)
      .patch(`/api/pharmacy-network/referrals/${foreignReferral._id}`)
      .set("Authorization", `Bearer ${pharmacistToken}`)
      .send({ status: "FULFILLED" });

    expect(res.status).toBe(403);
  });

  test("linked pharmacist can update own referral and emit audit", async () => {
    const res = await request(app)
      .patch(`/api/pharmacy-network/referrals/${referralId}`)
      .set("Authorization", `Bearer ${pharmacistToken}`)
      .send({ status: "ACCEPTED" });

    expect(res.status).toBe(200);
    expect(res.body.referral.status).toBe("ACCEPTED");

    const audit = await AuditLog.findOne({
      action: "PHARMACY_REFERRAL_UPDATE",
      resourceId: referralId,
    }).sort({ createdAt: -1 }).lean();
    expect(String(audit?.metadata?.pharmacyId)).toBe(pharmacyId);
  });
});
