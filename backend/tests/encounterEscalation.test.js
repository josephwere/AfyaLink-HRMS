import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import Encounter from "../models/Encounter.js";
import Notification from "../models/Notification.js";
import { WORKFLOW } from "../constants/workflowStates.js";

let teardown;
let hospitalId;
let patientId;
let encounterId;
let nurseToken;
let doctorToken;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Escalation Hospital",
    code: "ESC-01",
    active: true,
  });
  hospitalId = String(hospital._id);

  const [doctor, nurse, admin] = await User.create([
    {
      name: "Escalation Doctor",
      email: "escalation-doctor@afya.test",
      password: "Pass123!",
      role: "DOCTOR",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "Escalation Nurse",
      email: "escalation-nurse@afya.test",
      password: "Pass123!",
      role: "NURSE",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "Escalation Admin",
      email: "escalation-admin@afya.test",
      password: "Pass123!",
      role: "HOSPITAL_ADMIN",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
  ]);

  nurseToken = jwt.sign(
    { id: String(nurse._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  doctorToken = jwt.sign(
    { id: String(doctor._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const patient = await Patient.create({
    firstName: "Escalation",
    lastName: "Patient",
    hospital: hospital._id,
    nationalId: "ESC-PT-01",
    active: true,
  });
  patientId = String(patient._id);

  const encounter = new Encounter({
    patient: patient._id,
    doctor: doctor._id,
    hospital: hospital._id,
    state: WORKFLOW.CONSULTING,
    diagnosis: "",
    consultationNotes: "",
  });
  encounter.$locals.viaWorkflow = true;
  await encounter.save();
  encounterId = String(encounter._id);
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("nurse escalation can be created and resolved with encounter summary reflecting resolution", async () => {
  const createRes = await request(app)
    .post(`/api/encounters/${encounterId}/nurse-escalation`)
    .set("Authorization", `Bearer ${nurseToken}`)
    .send({ note: "Patient discharge is blocked pending clinician handoff." });

  expect(createRes.status).toBe(201);
  expect(createRes.body.ok).toBe(true);
  expect(createRes.body.recipients).toBeGreaterThan(0);

  const createdNotifications = await Notification.find({
    hospital: hospitalId,
    "meta.type": "NURSE_ESCALATION",
  }).lean();
  expect(
    createdNotifications.filter((row) => String(row?.meta?.encounterId || "") === encounterId).length
  ).toBeGreaterThan(0);

  const nurseHistoryRes = await request(app)
    .get(`/api/encounters?patientId=${patientId}&limit=1`)
    .set("Authorization", `Bearer ${nurseToken}`);

  expect(nurseHistoryRes.status).toBe(200);
  expect(nurseHistoryRes.body[0].escalationSummary.openCount).toBeGreaterThan(0);

  const resolveRes = await request(app)
    .post(`/api/encounters/${encounterId}/nurse-escalation-resolve`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({ note: "Clinician reviewed the visit and resumed closeout workflow." });

  expect(resolveRes.status).toBe(200);
  expect(resolveRes.body.ok).toBe(true);
  expect(resolveRes.body.resolved).toBeGreaterThan(0);

  const doctorHistoryRes = await request(app)
    .get(`/api/encounters?patientId=${patientId}&limit=1`)
    .set("Authorization", `Bearer ${doctorToken}`);

  expect(doctorHistoryRes.status).toBe(200);
  expect(doctorHistoryRes.body[0].escalationSummary.openCount).toBe(0);
  expect(doctorHistoryRes.body[0].escalationSummary.resolvedAt).toBeTruthy();
  expect(doctorHistoryRes.body[0].escalationSummary.resolvedBy?.name).toBe("Escalation Doctor");
});
