import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import Encounter from "../models/Encounter.js";
import { WORKFLOW } from "../constants/workflowStates.js";

let teardown;
let hospitalId;
let doctorAlphaId;
let doctorBetaId;
let nurseToken;
let adminToken;
let doctorAlphaToken;
let encounterAlphaId;
let encounterBetaId;
let encounterGammaId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Queue Hospital",
    code: "ESC-QUEUE",
    active: true,
    features: { payments: true, pharmacy: false },
  });
  hospitalId = String(hospital._id);

  const [doctorAlpha, doctorBeta, nurse, admin] = await User.create([
    {
      name: "Alpha Doctor",
      email: "alpha-doctor@afya.test",
      password: "Pass123!",
      role: "DOCTOR",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "Beta Doctor",
      email: "beta-doctor@afya.test",
      password: "Pass123!",
      role: "DOCTOR",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "Queue Nurse",
      email: "queue-nurse@afya.test",
      password: "Pass123!",
      role: "NURSE",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "Queue Admin",
      email: "queue-admin@afya.test",
      password: "Pass123!",
      role: "HOSPITAL_ADMIN",
      hospital: hospital._id,
      active: true,
      emailVerified: true,
    },
  ]);

  doctorAlphaId = String(doctorAlpha._id);
  doctorBetaId = String(doctorBeta._id);

  nurseToken = jwt.sign(
    { id: String(nurse._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  adminToken = jwt.sign(
    { id: String(admin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  doctorAlphaToken = jwt.sign(
    { id: String(doctorAlpha._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const patients = await Patient.create([
    {
      firstName: "Zed",
      lastName: "Billing",
      hospital: hospital._id,
      ward: "Ward C",
      nationalId: "QUEUE-PT-03",
      active: true,
    },
    {
      firstName: "Amy",
      lastName: "Diagnosis",
      hospital: hospital._id,
      ward: "Ward A",
      nationalId: "QUEUE-PT-01",
      active: true,
    },
    {
      firstName: "Ben",
      lastName: "Prescription",
      hospital: hospital._id,
      ward: "Ward B",
      nationalId: "QUEUE-PT-02",
      active: true,
    },
  ]);

  const buildEncounter = async (patient, doctor, diagnosis = "", consultationNotes = "") => {
    const row = new Encounter({
      patient,
      doctor,
      hospital: hospital._id,
      state: WORKFLOW.CONSULTING,
      diagnosis,
      consultationNotes,
    });
    row.$locals.viaWorkflow = true;
    await row.save();
    return row;
  };

  const [encounterAlpha, encounterBeta, encounterGamma] = await Promise.all([
    buildEncounter(patients[0]._id, doctorBeta._id, "Recovered pneumonia", "Doctor already documented assessment."),
    buildEncounter(patients[1]._id, doctorAlpha._id),
    buildEncounter(patients[2]._id, doctorAlpha._id, "Dispense review complete", "Prescription discussion recorded."),
  ]);

  encounterAlphaId = String(encounterAlpha._id);
  encounterBetaId = String(encounterBeta._id);
  encounterGammaId = String(encounterGamma._id);

  await request(app)
    .post(`/api/encounters/${encounterAlphaId}/nurse-escalation`)
    .set("Authorization", `Bearer ${nurseToken}`)
    .send({
      note: "Billing handoff still missing before discharge.",
    });

  await request(app)
    .post(`/api/encounters/${encounterBetaId}/nurse-escalation`)
    .set("Authorization", `Bearer ${nurseToken}`)
    .send({
      note: "Diagnosis still pending before ward discharge.",
    });

  await request(app)
    .post(`/api/encounters/${encounterGammaId}/nurse-escalation`)
    .set("Authorization", `Bearer ${nurseToken}`)
    .send({
      note: "Billing needs clinician handoff before release.",
    });

  await request(app)
    .post(`/api/encounters/${encounterGammaId}/nurse-escalation-resolve`)
    .set("Authorization", `Bearer ${doctorAlphaToken}`)
    .send({
      note: "Prescription prepared and reviewed.",
    });
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("escalation queue filters open items by missing requirement", async () => {
  const res = await request(app)
    .get("/api/encounters/escalations?status=OPEN&missingRequirement=BILLING")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body.total).toBe(2);
  expect(res.body.items).toHaveLength(2);
  expect(res.body.items.map((item) => item.encounterId)).toContain(encounterAlphaId);
  expect(res.body.items.every((item) => item.missingRequirements.includes("BILLING"))).toBe(true);
  expect(res.body.items.every((item) => item.status === "OPEN")).toBe(true);
});

test("escalation queue supports resolved status, clinician filter, patient sort, and paging", async () => {
  const resolvedRes = await request(app)
    .get("/api/encounters/escalations?status=RESOLVED")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(resolvedRes.status).toBe(200);
  expect(resolvedRes.body.total).toBe(1);
  expect(resolvedRes.body.items[0].encounterId).toBe(encounterGammaId);
  expect(resolvedRes.body.items[0].status).toBe("RESOLVED");

  const clinicianRes = await request(app)
    .get(`/api/encounters/escalations?status=ALL&clinicianId=${doctorAlphaId}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(clinicianRes.status).toBe(200);
  expect(clinicianRes.body.total).toBe(2);
  expect(clinicianRes.body.items.every((item) => String(item.clinicianId) === doctorAlphaId)).toBe(true);

  const sortedRes = await request(app)
    .get("/api/encounters/escalations?status=ALL&sort=PATIENT")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(sortedRes.status).toBe(200);
  expect(sortedRes.body.total).toBe(3);
  expect(sortedRes.body.items.map((item) => item.patientName)).toEqual([
    "Amy Diagnosis",
    "Ben Prescription",
    "Zed Billing",
  ]);

  const pagedRes = await request(app)
    .get("/api/encounters/escalations?status=ALL&sort=PATIENT&page=2&pageSize=1")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(pagedRes.status).toBe(200);
  expect(pagedRes.body.total).toBe(3);
  expect(pagedRes.body.page).toBe(2);
  expect(pagedRes.body.pageSize).toBe(1);
  expect(pagedRes.body.items).toHaveLength(1);
  expect(pagedRes.body.items[0].patientName).toBe("Ben Prescription");
});

test("doctor queue is scoped to own escalations and bulk resolve closes selected items", async () => {
  const doctorScopedRes = await request(app)
    .get("/api/encounters/escalations?status=ALL")
    .set("Authorization", `Bearer ${doctorAlphaToken}`);

  expect(doctorScopedRes.status).toBe(200);
  expect(doctorScopedRes.body.total).toBe(2);
  expect(doctorScopedRes.body.items.every((item) => String(item.clinicianId) === doctorAlphaId)).toBe(true);

  const openDoctorIds = doctorScopedRes.body.items
    .filter((item) => item.status === "OPEN")
    .map((item) => item.encounterId);
  expect(openDoctorIds).toContain(encounterBetaId);

  const bulkResolveRes = await request(app)
    .post("/api/encounters/escalations/bulk-resolve")
    .set("Authorization", `Bearer ${doctorAlphaToken}`)
    .send({
      encounterIds: [encounterBetaId],
      note: "Resolved from doctor queue.",
    });

  expect(bulkResolveRes.status).toBe(200);
  expect(bulkResolveRes.body.ok).toBe(true);
  expect(bulkResolveRes.body.encounters).toBe(1);
  expect(bulkResolveRes.body.resolved).toBeGreaterThan(0);

  const resolvedRes = await request(app)
    .get("/api/encounters/escalations?status=RESOLVED")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(resolvedRes.status).toBe(200);
  expect(resolvedRes.body.items.map((item) => item.encounterId)).toEqual(
    expect.arrayContaining([encounterBetaId, encounterGammaId])
  );
});

test("bulk assign updates clinician and bulk review marks reviewed", async () => {
  const assignRes = await request(app)
    .post("/api/encounters/escalations/bulk-assign")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      encounterIds: [encounterAlphaId],
      clinicianId: doctorAlphaId,
    });

  expect(assignRes.status).toBe(200);
  expect(assignRes.body.updated).toBe(1);

  const clinicianRes = await request(app)
    .get(`/api/encounters/escalations?status=ALL&clinicianId=${doctorAlphaId}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(clinicianRes.status).toBe(200);
  expect(clinicianRes.body.items.map((item) => item.encounterId)).toContain(encounterAlphaId);

  const reviewRes = await request(app)
    .post("/api/encounters/escalations/bulk-review")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ encounterIds: [encounterAlphaId] });

  expect(reviewRes.status).toBe(200);
  expect(reviewRes.body.reviewed).toBeGreaterThan(0);
});
