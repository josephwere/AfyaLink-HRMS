import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import Prescription from "../models/Prescription.js";
import PharmacyReferral from "../models/PharmacyReferral.js";

let teardown;
let hospital;
let doctor;
let pharmacist;
let otherPharmacist;
let patientUser;
let patientRecord;
let prescription;
let pharmacy;
let otherPharmacy;
let pharmacistToken;
let otherPharmacistToken;

const signFor = (user) =>
  jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

beforeAll(async () => {
  teardown = await setup();

  hospital = await Hospital.create({
    name: "Prescription Scope Hospital",
    active: true,
    features: { pharmacy: true },
  });

  doctor = await User.create({
    name: "Scope Doctor",
    email: "scope-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });

  pharmacist = await User.create({
    name: "Scoped Pharmacist Rx",
    email: "scope-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  otherPharmacist = await User.create({
    name: "Other Pharmacist Rx",
    email: "scope-other-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  patientUser = await User.create({
    name: "Prescription Patient",
    email: "scope-patient@afya.test",
    password: "Pass123!",
    role: "PATIENT",
    hospital: hospital._id,
    active: true,
  });

  patientRecord = await Patient.create({
    firstName: "Scope",
    lastName: "Patient",
    hospital: hospital._id,
    metadata: { userId: patientUser._id },
  });

  pharmacy = await RegisteredPharmacy.create({
    name: "Scoped Dispense Pharmacy",
    licenseNumber: "PHARM-RX-001",
    status: "ACTIVE",
    createdBy: doctor._id,
    updatedBy: doctor._id,
  });

  otherPharmacy = await RegisteredPharmacy.create({
    name: "Other Dispense Pharmacy",
    licenseNumber: "PHARM-RX-002",
    status: "ACTIVE",
    createdBy: doctor._id,
    updatedBy: doctor._id,
  });

  pharmacist.registeredPharmacy = pharmacy._id;
  await pharmacist.save();
  otherPharmacist.registeredPharmacy = otherPharmacy._id;
  await otherPharmacist.save();

  prescription = new Prescription({
    patient: patientUser._id,
    patientRecord: patientRecord._id,
    doctor: doctor._id,
    hospital: hospital._id,
    medications: [{ name: "Amoxicillin", dosage: "500mg", frequency: "BD", duration: "5 days" }],
    summary: "Antibiotic course",
    advice: "Use after meals",
    status: "CREATED",
  });
  prescription.$locals = { viaWorkflow: true };
  await prescription.save();

  await PharmacyReferral.create({
    hospital: hospital._id,
    pharmacy: pharmacy._id,
    prescription: prescription._id,
    patientName: "Scope Patient",
    patientUser: patientUser._id,
    patientRecord: patientRecord._id,
    reason: "Dispense the antibiotic course",
    createdBy: doctor._id,
    updatedBy: doctor._id,
  });

  pharmacistToken = signFor(pharmacist);
  otherPharmacistToken = signFor(otherPharmacist);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Pharmacy prescription scoping", () => {
  test("linked pharmacist only lists referred prescriptions for own pharmacy", async () => {
    const res = await request(app)
      .get("/api/pharmacy/prescriptions")
      .set("Authorization", `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(String(res.body.items[0]._id)).toBe(String(prescription._id));
  });

  test("other pharmacist sees no prescriptions without matching referral", async () => {
    const res = await request(app)
      .get("/api/pharmacy/prescriptions")
      .set("Authorization", `Bearer ${otherPharmacistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(0);
  });

  test("pharmacist outside scope cannot dispense prescription", async () => {
    const res = await request(app)
      .post("/api/pharmacy/dispense")
      .set("Authorization", `Bearer ${otherPharmacistToken}`)
      .send({ prescriptionId: prescription._id });

    expect(res.status).toBe(403);
  });

  test("linked pharmacist can dispense referred prescription", async () => {
    const res = await request(app)
      .post("/api/pharmacy/dispense")
      .set("Authorization", `Bearer ${pharmacistToken}`)
      .send({ prescriptionId: prescription._id });

    expect(res.status).toBe(200);
    expect(res.body.prescription.status).toBe("DISPENSED");
  });
});
