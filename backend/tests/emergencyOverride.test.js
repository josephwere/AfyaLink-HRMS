import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Bed from "../models/Bed.js";
import AuditLog from "../models/AuditLog.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});
afterAll(async () => {
  if (teardown) await teardown();
});

test("emergency override activation allows scoped bypass", async () => {
  const [hospital] = await Hospital.create([{ name: "E-HOSP", code: "E", active: true }]);

  const admin = await User.create({ name: "Admin", email: "a@e.test", password: "Pass123!", role: "HOSPITAL_ADMIN", hospital: hospital._id, active: true, emailVerified: true });

  const nurse = await User.create({ name: "Nurse", email: "n@e.test", password: "Pass123!", role: "NURSE", hospital: hospital._id, active: true, emailVerified: true, metadata: { wardAccess: ["Ward X"] } });

  const adminToken = jwt.sign({ id: String(admin._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const nurseToken = jwt.sign({ id: String(nurse._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);

  const [bed1, bed2] = await Bed.create([
    { hospital: hospital._id, ward: "Ward X", number: "X-1", occupied: false },
    { hospital: hospital._id, ward: "Ward Y", number: "Y-1", occupied: false },
  ]);

  // Activate emergency
  const actRes = await request(app).post("/api/emergency/activate").set("Authorization", `Bearer ${adminToken}`).send({ reason: "Code blue", durationMinutes: 5 });
  expect(actRes.status).toBe(201);
  expect(actRes.body.token).toBeTruthy();
  const token = actRes.body.token;

  // Nurse without access tries to update bed in Ward Y — should succeed under emergency token
  const mutateRes = await request(app).put(`/api/beds/${bed2._id}`).set("Authorization", `Bearer ${nurseToken}`).set("x-emergency-token", token).send({ occupied: true, patient: null });
  expect(mutateRes.status).toBe(200);

  // Audit should contain the break-glass activation
  const auditEntry = await AuditLog.findOne({ action: "BREAK_GLASS_ACTIVATED" }).lean();
  expect(auditEntry).toBeTruthy();
  expect(auditEntry.metadata?.reason).toBe("Code blue");
});
