import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Prescription from "../models/Prescription.js";

let teardown;
let doctorToken;
let patientId;
let hospitalId;

beforeAll(async () => {
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Prescription Runtime Hospital", code: "RX-RT", active: true });
  hospitalId = String(hospital._id);
  const doctor = await User.create({
    name: "Prescription Runtime Doctor",
    email: "prescription-runtime-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });
  const patient = await Patient.create({
    firstName: "Rx",
    lastName: "Patient",
    hospital: hospital._id,
    nationalId: "RX-100",
    contact: "+254700000222",
    active: true,
    metadata: { userId: doctor._id },
  });
  patientId = String(patient._id);
  doctorToken = jwt.sign({ id: String(doctor._id), twoFactorVerified: true, hospital: hospitalId, role: "DOCTOR" }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("prescription runtime can create and dispense prescriptions", async () => {
  const createRes = await request(app)
    .post("/api/prescriptions")
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      patient: patientId,
      patientRecord: patientId,
      doctor: null,
      hospital: hospitalId,
      medications: [{ name: "Paracetamol", dosage: "500mg", frequency: "TDS", duration: "3 days" }],
      summary: "Pain relief",
      advice: "Take after meals",
    });

  expect(createRes.status).toBe(201);
  expect(createRes.body.item.status).toBe("CREATED");
  const prescriptionId = createRes.body.item._id;

  const transitionRes = await request(app)
    .post(`/api/prescriptions/${prescriptionId}/transition`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({ to: "DISPENSED" });

  expect(transitionRes.status).toBe(200);
  expect(transitionRes.body.item.status).toBe("DISPENSED");

  const stored = await Prescription.findById(prescriptionId).lean();
  expect(stored?.status).toBe("DISPENSED");
});
