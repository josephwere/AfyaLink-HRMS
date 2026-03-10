import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Bed from "../models/Bed.js";
import Patient from "../models/Patient.js";
import Encounter from "../models/Encounter.js";
import { WORKFLOW } from "../constants/workflowStates.js";

let teardown;
let hospitalAdminToken;
let nurseToken;
let doctorToken;
let otherHospitalBedId;
let ownHospitalBedId;
let transferTargetBedId;
let patientId;
let hospitalAId;
let adminId;

beforeAll(async () => {
  teardown = await setup();

  const [hospitalA, hospitalB] = await Hospital.create([
    { name: "Hospital A", code: "BED-A", active: true },
    { name: "Hospital B", code: "BED-B", active: true },
  ]);
  hospitalAId = String(hospitalA._id);

  const admin = await User.create({
    name: "Bed Admin",
    email: "bed-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospitalA._id,
    active: true,
    emailVerified: true,
  });
  adminId = String(admin._id);

  const nurse = await User.create({
    name: "Ward Nurse",
    email: "ward-nurse@afya.test",
    password: "Pass123!",
    role: "NURSE",
    hospital: hospitalA._id,
    active: true,
    emailVerified: true,
  });

  const doctor = await User.create({
    name: "Ward Doctor",
    email: "ward-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospitalA._id,
    active: true,
    emailVerified: true,
  });

  hospitalAdminToken = jwt.sign(
    { id: String(admin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  nurseToken = jwt.sign(
    { id: String(nurse._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  doctorToken = jwt.sign(
    { id: String(doctor._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const beds = await Bed.create([
    { hospital: hospitalA._id, ward: "Ward 1", number: "A-1", occupied: false },
    { hospital: hospitalA._id, ward: "Ward 1", number: "A-2", occupied: false },
    { hospital: hospitalB._id, ward: "Ward 2", number: "B-1", occupied: false },
  ]);

  ownHospitalBedId = String(beds[0]._id);
  transferTargetBedId = String(beds[1]._id);
  otherHospitalBedId = String(beds[2]._id);

  const patient = await Patient.create({
    firstName: "Bed",
    lastName: "Patient",
    hospital: hospitalA._id,
    nationalId: "BED-PT-1",
    active: true,
  });
  patientId = String(patient._id);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Beds hospital scope", () => {
  beforeEach(async () => {
    await Bed.updateMany(
      { _id: { $in: [ownHospitalBedId, transferTargetBedId, otherHospitalBedId] } },
      { $set: { occupied: false, patient: null } }
    );
    await Encounter.deleteMany({});
  });

  test("hospital admin only sees own hospital beds and cannot mutate another hospital bed", async () => {
    const listRes = await request(app)
      .get("/api/beds")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data.map((row) => row.number).sort()).toEqual(["A-1", "A-2"]);
    expect(listRes.body.data.every((row) => String(row.hospital?._id) === hospitalAId)).toBe(true);

    const updateRes = await request(app)
      .put(`/api/beds/${otherHospitalBedId}`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ occupied: true, patient: null });

    expect(updateRes.status).toBe(404);
  });

  test("nurse can access ward beds within own hospital", async () => {
    const res = await request(app)
      .get("/api/beds")
      .set("Authorization", `Bearer ${nurseToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((row) => String(row.hospital?._id) === hospitalAId)).toBe(true);
  });

  test("doctor can view ward beds but cannot change occupancy", async () => {
    const listRes = await request(app)
      .get("/api/beds")
      .set("Authorization", `Bearer ${doctorToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data).toHaveLength(2);

    const mutateRes = await request(app)
      .put(`/api/beds/${ownHospitalBedId}`)
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({ occupied: true, patient: patientId });

    expect(mutateRes.status).toBe(403);
  });

  test("hospital admin cannot release a bed while patient has an open encounter", async () => {
    await request(app)
      .put(`/api/beds/${ownHospitalBedId}`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ occupied: true, patient: patientId });

    const encounter = new Encounter({
      patient: patientId,
      doctor: adminId,
      hospital: hospitalAId,
      state: WORKFLOW.CONSULTING,
    });
    encounter.$locals.viaWorkflow = true;
    await encounter.save();

    const releaseRes = await request(app)
      .put(`/api/beds/${ownHospitalBedId}`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ occupied: false, patient: null });

    expect(releaseRes.status).toBe(409);
    expect(releaseRes.body.code).toBe("BED_RELEASE_BLOCKED");
  });

  test("hospital admin can transfer a patient between beds in the same hospital", async () => {
    await request(app)
      .put(`/api/beds/${ownHospitalBedId}`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ occupied: true, patient: patientId });

    const transferRes = await request(app)
      .post(`/api/beds/${ownHospitalBedId}/transfer`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ targetBedId: transferTargetBedId });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.data.source.occupied).toBe(false);
    expect(String(transferRes.body.data.target.patient)).toBe(String(patientId));

    const [sourceBed, targetBed] = await Promise.all([
      Bed.findById(ownHospitalBedId).lean(),
      Bed.findById(transferTargetBedId).lean(),
    ]);
    expect(sourceBed.occupied).toBe(false);
    expect(sourceBed.patient).toBeNull();
    expect(targetBed.occupied).toBe(true);
    expect(String(targetBed.patient)).toBe(String(patientId));

    const timelineRes = await request(app)
      .get(`/api/beds/${transferTargetBedId}/timeline`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(timelineRes.status).toBe(200);
    expect(Array.isArray(timelineRes.body.data.logs)).toBe(true);
    expect(timelineRes.body.data.logs.some((row) => row.action === "BED_TRANSFER")).toBe(true);
    const transferAudit = timelineRes.body.data.logs.find((row) => row.action === "BED_TRANSFER");
    expect(transferAudit?.metadata?.sourceBedId).toBe(ownHospitalBedId);
    expect(transferAudit?.metadata?.targetBedId).toBe(transferTargetBedId);
  });

  test("hospital admin can discharge a patient after encounter is closed", async () => {
    await request(app)
      .put(`/api/beds/${ownHospitalBedId}`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ occupied: true, patient: patientId });

    const encounter = new Encounter({
      patient: patientId,
      doctor: adminId,
      hospital: hospitalAId,
      state: WORKFLOW.CLOSED,
    });
    encounter.$locals.viaWorkflow = true;
    await encounter.save();

    const dischargeRes = await request(app)
      .post(`/api/beds/${ownHospitalBedId}/discharge`)
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ note: "Stable for discharge" });

    expect(dischargeRes.status).toBe(200);
    expect(dischargeRes.body.message).toBe("Bed discharge completed");

    const dischargedBed = await Bed.findById(ownHospitalBedId).lean();
    expect(dischargedBed.occupied).toBe(false);
    expect(dischargedBed.patient).toBeNull();
  });
});
